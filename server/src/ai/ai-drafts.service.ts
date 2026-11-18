import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { DatabaseService } from '../database/database.service'
import { AiAccessService } from './ai-access.service'
import { record, revision, text, uuid } from './ai-input'
import { draftFields, frames, jobFields, newState, parseJson, parseStage, parseTarget, preserveLegacyPlan, readReference, resolveInterruptedChat, retention, stages } from './ai-draft.model'
import type { DraftRow, DraftState, JobRow, Target } from './ai-draft.model'

export interface AiIdentity { id: string; name: string; tokenHash: Buffer }

export async function writeDraft(connection: PoolConnection, draft: DraftRow, state: DraftState) {
  await connection.execute(`UPDATE ai_drafts SET state = ?, expires_at = UTC_TIMESTAMP(3) + ${retention} WHERE id = ?`,
    [JSON.stringify(state), draft.id])
  const ids = Object.values(state.assets)
  if (ids.length) await connection.execute(`UPDATE ai_assets SET expires_at = UTC_TIMESTAMP(3) + ${retention}
    WHERE user_id = ? AND is_ready = 1 AND expires_at > UTC_TIMESTAMP(3) AND id IN (${ids.map(() => '?').join(',')})`,
  [draft.userId, ...ids])
}

function imageTargets(state: DraftState, kind: unknown, target: unknown): Target[] {
  if (!state.plan || !state.isPlanReady) throw new ConflictException('请先完成植物档案。')
  if (kind === 'bases') return stages.map((stage): Target => `${stage}:idle`).filter((slot) => !state.assets[slot])
  if (kind === 'frame') {
    const slot = parseTarget(target)
    const stage = parseStage(slot.split(':')[0])
    if (slot.endsWith(':idle') || state.confirmed.includes(stage)) return [slot]
    throw new ConflictException('请先确认该阶段主形象。')
  }
  if (kind !== 'derived') throw new BadRequestException('任务类型无效。')
  if (state.confirmed.length !== stages.length) throw new ConflictException('请先确认三个阶段的主形象。')
  return stages.flatMap((stage) => frames.filter((frame) => frame !== 'idle')
    .map((frame): Target => `${stage}:${frame}`)).filter((slot) => !state.assets[slot])
}

@Injectable()
export class AiDraftsService {
  constructor(private readonly database: DatabaseService, private readonly access: AiAccessService) {}

  async snapshot(identity: AiIdentity) {
    return this.withDraft(identity, async (connection, draft, state) => {
      const jobs = state.lastOperation ? await this.operationJobs(connection, identity.id, state.lastOperation) : []
      resolveInterruptedChat(state, jobs)
      const { reference, uploadRetries, ...visible } = state
      return { id: draft.id, expiresAt: draft.expiresAt, ...visible,
        uploadRetries,
        hasReference: Boolean(reference), jobs: jobs.map(({ id, type, target, status, errorMessage, hasImage }) => ({
          id, type, target, status, errorMessage,
          canRetryUpload: status === 'failed' && Boolean(hasImage),
          isUploadOnly: status === 'queued' && Boolean(hasImage),
        })) }
    })
  }

  async reference(identity: AiIdentity) {
    return this.withDraft(identity, (_connection, _draft, state) => Promise.resolve({ image: state.reference }))
  }

  async update(identity: AiIdentity, body: unknown): Promise<void> {
    const input = record(body)
    return this.withDraft(identity, async (connection, draft, state) => {
      await this.requireIdle(connection, draft, state, input)
      if (input.kind === 'reference') {
        state.reference = readReference(input.image)
        state.isPlanReady = false
        state.assets = {}
        state.uploadRetries = {}
        state.confirmed = []
        state.lastOperation = null
      } else if (input.kind === 'confirm') {
        const stage = parseStage(input.stage)
        if (state.assets[`${stage}:idle`] !== uuid(input.assetId)) throw new ConflictException('主形象已变化，请刷新。')
        if (!state.confirmed.includes(stage)) state.confirmed.push(stage)
      } else if (input.kind === 'reset') {
        await connection.execute('DELETE FROM ai_drafts WHERE id = ?', [draft.id])
        return
      } else {
        throw new BadRequestException('不支持的草稿操作。')
      }
      state.version += 1
      await writeDraft(connection, draft, state)
    })
  }

  async submit(identity: AiIdentity, body: unknown) {
    const input = record(body)
    const key = uuid(input.operationId)
    return this.withDraft(identity, async (connection, draft, state, isAiDisabled) => {
      const existing = await this.operationJobs(connection, identity.id, key)
      if (existing.length) return { operationId: key }
      const isRetry = input.kind === 'upload'
      if (isAiDisabled && !isRetry) throw new ForbiddenException('你的 AI 已停用，请联系管理员。')
      await this.requireIdle(connection, draft, state, input)
      if (!isRetry) await this.requireOnline(connection)
      if (isRetry) await this.retryUpload(connection, draft, state, input, key)
      else await this.enqueue(connection, draft, state, input, key)
      state.lastOperation = key
      state.version += 1
      await writeDraft(connection, draft, state)
      return { operationId: key }
    })
  }

  private async enqueue(connection: PoolConnection, draft: DraftRow, state: DraftState, input: Record<string, unknown>, key: string) {
    const kind = input.kind
    const isChat = kind === 'chat'
    const targets = isChat ? ['chat'] : imageTargets(state, kind, input.target)
    if (!targets.length) throw new ConflictException('没有待生成的图片。')
    const message = isChat ? text(input.text, 1000, '对话内容') : null
    const payload = message === null ? null : JSON.stringify({ text: message })
    if (message !== null) {
      state.messages.push({ id: key, role: 'user', text: message, status: 'pending', hasImage: Boolean(state.reference) })
      state.messages = state.messages.slice(-40)
    }
    for (const target of targets) {
      if (target !== 'chat') delete state.uploadRetries[target as Target]
      await connection.execute(`INSERT INTO ai_jobs (id, operation_id, draft_id, user_id, type, target, payload, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', UTC_TIMESTAMP(3))`,
      [randomUUID(), key, draft.id, draft.userId, isChat ? 'chat' : 'image', target, payload])
    }
  }

  private async retryUpload(connection: PoolConnection, draft: DraftRow, state: DraftState, input: Record<string, unknown>, key: string) {
    const previousId = uuid(input.jobId)
    const [[previous]] = await connection.execute<(JobRow & { hasBytes: number })[]>(`SELECT ${jobFields},
      image_blob IS NOT NULL AS hasBytes FROM ai_jobs WHERE id = ? AND draft_id = ? FOR UPDATE`, [previousId, draft.id])
    if (!previous?.hasBytes || previous.type !== 'image' || previous.status !== 'failed' ||
      state.uploadRetries[previous.target as Target] !== previous.id) {
      throw new ConflictException('没有可重试上传的图片，请重新生成。')
    }
    await connection.execute(`INSERT INTO ai_jobs (id, operation_id, draft_id, user_id, type, target, image_blob, status, created_at)
      SELECT ?, ?, draft_id, user_id, 'image', target, image_blob, 'queued', UTC_TIMESTAMP(3) FROM ai_jobs WHERE id = ?`,
    [randomUUID(), key, previousId])
    await connection.execute('UPDATE ai_jobs SET image_blob = NULL WHERE id = ?', [previousId])
    delete state.uploadRetries[previous.target as Target]
  }

  private async requireOnline(connection: PoolConnection) {
    const [[settings]] = await connection.execute<RowDataPacket[]>(`SELECT is_paused, credentials IS NOT NULL AS hasKey,
      EXISTS(SELECT 1 FROM tos_settings WHERE id = 1) AS hasTos FROM ai_settings WHERE id = 1 LOCK IN SHARE MODE`)
    if (settings?.is_paused) throw new ServiceUnavailableException('AI 已暂停，新任务暂不可提交。')
    if (!settings?.hasKey || !settings.hasTos) throw new ServiceUnavailableException('AI 服务尚未配置，请联系管理员。')
  }

  private async requireIdle(connection: PoolConnection, draft: DraftRow, state: DraftState, input: Record<string, unknown>) {
    if (draft.id !== uuid(input.draftId) || state.version !== revision(input.version)) {
      throw new ConflictException('草稿已更新，请重新加载。')
    }
    const [[job]] = await connection.execute<RowDataPacket[]>(`SELECT id FROM ai_jobs WHERE draft_id = ?
      AND status IN ('queued', 'running') LIMIT 1`, [draft.id])
    if (job) throw new ConflictException('当前草稿仍有任务在运行或等待，请稍后重试。')
    if (state.lastOperation && state.messages.at(-1)?.status === 'pending') {
      resolveInterruptedChat(state, await this.operationJobs(connection, draft.userId, state.lastOperation))
    }
  }

  private async operationJobs(connection: PoolConnection, userId: string, key: string) {
    const [jobs] = await connection.execute<(JobRow & { hasImage: number })[]>(`SELECT ${jobFields},
      image_blob IS NOT NULL AS hasImage FROM ai_jobs
      WHERE user_id = ? AND operation_id = ? ORDER BY created_at, target`, [userId, key])
    return jobs
  }

  private async withDraft<T>(identity: AiIdentity, action: (connection: PoolConnection, row: DraftRow, state: DraftState, isAiDisabled: boolean) => Promise<T>): Promise<T> {
    return this.database.transaction(async (connection) => {
      const { isAiDisabled } = await this.access.requireCurrent(connection, identity.id, identity.tokenHash)
      const [[current]] = await connection.execute<DraftRow[]>(`SELECT ${draftFields} FROM ai_drafts WHERE user_id = ? FOR UPDATE`, [identity.id])
      if (current && current.expiresAt.getTime() > Date.now()) {
        const state = parseJson(current.state)
        preserveLegacyPlan(state)
        return action(connection, current, state, Boolean(isAiDisabled))
      }
      const state = newState()
      const id = randomUUID()
      await connection.execute(`INSERT INTO ai_drafts (user_id, id, state, expires_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3) + ${retention})
        ON DUPLICATE KEY UPDATE id = VALUES(id), state = VALUES(state), expires_at = VALUES(expires_at)`, [identity.id, id, JSON.stringify(state)])
      return action(connection, { id, userId: identity.id, state, expiresAt: new Date(Date.now() + 30 * 86_400_000) } as DraftRow, state, Boolean(isAiDisabled))
    })
  }
}
