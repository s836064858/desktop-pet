import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { setTimeout as delay } from 'node:timers/promises'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { DatabaseService } from '../database/database.service'
import { AiAssetsService } from './ai-assets.service'
import { acceptPlan, draftFields, invalidateStage, jobFields, parseJson, readPlanReply, retention } from './ai-draft.model'
import type { ChatMessage, DraftRow, DraftState, Frame, JobRow, Stage, Target } from './ai-draft.model'
import { writeDraft } from './ai-drafts.service'
import { imageRequest, planRequest, styleReference } from './ai-prompt'
import { AiSettingsService } from './ai-settings.service'
import { ArkError, CHAT_MODEL, IMAGE_MODEL, arkImage, arkRequest, arkText, arkUsage } from './ark-provider'
import type { ArkUsage } from './ark-provider'

interface ClaimedJob extends JobRow { credentials: Buffer | null; hasImage: number }

function completeChat(state: DraftState, job: JobRow, text: string, errorMessage: string | null): void {
  const queued = state.messages.find((message) => message.id === job.operationId)
  const message: ChatMessage = {
    id: queued?.id ?? job.id, role: 'user', text, status: errorMessage ? 'error' : 'done',
    hasImage: queued?.hasImage ?? Boolean(state.reference), ...(errorMessage && { errorMessage }),
  }
  state.messages = [...state.messages.filter(({ id }) => id !== message.id), message].slice(-40)
}

@Injectable()
export class AiWorker implements OnModuleInit, OnModuleDestroy {
  private readonly controller = new AbortController()
  private readonly logger = new Logger(AiWorker.name)
  private loop?: Promise<void>
  private sweepAt = 0

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: AiSettingsService,
    private readonly assets: AiAssetsService,
  ) {}

  onModuleInit(): void {
    this.loop = this.run(this.controller.signal)
  }

  async onModuleDestroy(): Promise<void> {
    this.controller.abort()
    await this.loop
  }

  private async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        if (Date.now() >= this.sweepAt) {
          this.sweepAt = Date.now() + 60_000
          await this.sweep()
        }
        const job = await this.claim()
        if (job) {
          await this.process(job, signal)
          continue
        }
      } catch {
        this.logger.warn('AI 队列本轮未完成，将重新检查任务状态。')
      }
      await delay(1000, undefined, { signal }).catch(() => undefined)
    }
  }

  private async claim(): Promise<ClaimedJob | undefined> {
    return this.database.transaction(async (connection) => {
      const [[job]] = await connection.execute<ClaimedJob[]>(`SELECT ${jobFields}, image_blob IS NOT NULL AS hasImage
        FROM ai_jobs WHERE status = 'queued' AND EXISTS (SELECT 1 FROM ai_users
          WHERE id = ai_jobs.user_id AND revoked_at IS NULL AND (is_ai_disabled = 0 OR ai_jobs.image_blob IS NOT NULL))
        AND EXISTS (SELECT 1 FROM ai_drafts WHERE id = ai_jobs.draft_id AND expires_at > UTC_TIMESTAMP(3))
        AND (image_blob IS NOT NULL OR EXISTS (SELECT 1 FROM ai_settings
          WHERE id = 1 AND is_paused = 0 AND credentials IS NOT NULL)) ORDER BY created_at, id LIMIT 1`)
      if (!job) return
      const [[identity]] = await connection.execute<RowDataPacket[]>(`SELECT is_ai_disabled, revoked_at
        FROM ai_users WHERE id = ? LOCK IN SHARE MODE`, [job.userId])
      if (!identity || identity.revoked_at || (identity.is_ai_disabled && !job.hasImage)) return
      const [[settings]] = await connection.execute<RowDataPacket[]>(`SELECT is_paused, credentials
        FROM ai_settings WHERE id = 1 LOCK IN SHARE MODE`)
      if (!settings || (!job.hasImage && (settings.is_paused || !settings.credentials))) return
      const [claimed] = await connection.execute<ResultSetHeader>(`UPDATE ai_jobs SET status = 'running', started_at = UTC_TIMESTAMP(3)
        WHERE id = ? AND status = 'queued'`, [job.id])
      if (claimed.affectedRows !== 1) return
      return { ...job, credentials: settings.credentials as Buffer | null }
    })
  }

  private async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    try {
      const [draft] = await this.database.execute<DraftRow[]>(`SELECT ${draftFields} FROM ai_drafts WHERE id = ?`, [job.draftId])
      if (!draft) throw new Error('草稿已失效')
      const state = parseJson(draft.state)
      if (job.type === 'chat') {
        const input = parseJson<{ text: string }>(job.payload as string | { text: string }).text
        const body = await planRequest(state, input)
        const result = await this.callArk({ job, path: '/responses', body, signal, parse: (response) => readPlanReply(arkText(response)) })
        await this.finish(job, 'done', null, (latest) => {
          latest.isPlanReady = false
          if (result.plan) acceptPlan(latest, result.plan)
          completeChat(latest, job, input, null)
          latest.messages.push({
            id: `${job.id}-reply`, role: 'assistant', text: result.reply, status: 'done',
            ...(result.plan ? { plan: result.plan } : { needsClarification: true }),
          })
          latest.messages = latest.messages.slice(-40)
        })
        return
      }
      await this.processImage(job, state, signal)
    } catch (error) {
      const result = error instanceof ArkError ? error.result : 'failed'
      const message = error instanceof ArkError ? error.message : '任务未完成，请检查配置或重试。'
      await this.finish(job, result, message)
    }
  }

  private async processImage(job: ClaimedJob, state: DraftState, signal: AbortSignal): Promise<void> {
    const slot = job.target as Target
    const [stage, frame] = slot.split(':') as [Stage, Frame]
    const bytes = job.hasImage ? await this.cachedImage(job.id) : await this.generate(job, state, stage, frame, signal)
    try {
      await this.assets.upload(job.id, job.userId, bytes)
    } catch {
      await this.finish(job, 'failed', '图片已生成，TOS 上传失败，可以重试上传原图。', (latest) => {
        latest.uploadRetries[slot] = job.id
      })
      return
    }
    await this.finish(job, 'done', null, (latest) => {
      if (frame === 'idle') invalidateStage(latest, stage)
      latest.assets[slot] = job.id
    })
  }

  private async generate(job: ClaimedJob, state: DraftState, stage: Stage, frame: Frame, signal: AbortSignal): Promise<Buffer> {
    const baseId = state.assets[`${stage}:idle`]
    const reference = frame === 'idle' ? await styleReference() : await this.assets.read(job.userId, baseId ?? '')
    const body = await imageRequest(state, stage, frame, reference)
    return this.callArk({ job, path: '/images/generations', body, signal, parse: arkImage, storeImage: true })
  }

  private async cachedImage(id: string): Promise<Buffer> {
    const [row] = await this.database.execute<RowDataPacket[]>('SELECT image_blob AS bytes FROM ai_jobs WHERE id = ?', [id])
    if (!Buffer.isBuffer(row?.bytes)) throw new Error('图片缓存不存在')
    return row.bytes
  }

  private async callArk<T>(options: {
    job: ClaimedJob; path: string; body: object; signal: AbortSignal; storeImage?: boolean
    parse: (response: Awaited<ReturnType<typeof arkRequest>>) => T
  }): Promise<T> {
    const { job, path, body, signal, parse } = options
    if (!job.credentials) throw new Error('未配置方舟')
    const key = this.settings.openKey(job.credentials)
    signal.throwIfAborted()
    await this.database.execute(`INSERT INTO ai_usage (job_id, user_id, model, type, result, started_at)
      VALUES (?, ?, ?, ?, 'running', UTC_TIMESTAMP(3))`, [job.id, job.userId, job.type === 'chat' ? CHAT_MODEL : IMAGE_MODEL, job.type])
    let used = arkUsage()
    try {
      const response = await arkRequest({ key, path, body, signal })
      used = arkUsage(response)
      let output: T
      try {
        output = parse(response)
      } catch (error) {
        if (error instanceof ArkError) throw error
        throw new ArkError('方舟返回的植物档案不完整，请补充描述后重试。', 'failed')
      }
      await this.database.transaction(async (connection) => {
        if (options.storeImage && Buffer.isBuffer(output)) {
          used.generatedImages ??= 1
          await connection.execute('UPDATE ai_jobs SET image_blob = ? WHERE id = ?', [output, job.id])
        }
        await this.completeUsage(connection, job.id, 'success', used)
      })
      return output
    } catch (error) {
      const kind = error instanceof ArkError ? error.result : 'unknown'
      await this.database.withConnection((connection) => this.completeUsage(connection, job.id, kind, used))
      throw new ArkError(error instanceof ArkError ? error.message : '方舟结果未能确认，请检查档案后重试。', kind)
    }
  }

  private async completeUsage(connection: PoolConnection, id: string, result: string, used: ArkUsage) {
    const { inputTokens, outputTokens, cachedInputTokens, generatedImages } = used
    await connection.execute(`UPDATE ai_usage SET result = ?, input_tokens = ?, output_tokens = ?,
      cached_input_tokens = ?, generated_images = ?, finished_at = UTC_TIMESTAMP(3)
      WHERE job_id = ? AND result = 'running'`, [result, inputTokens, outputTokens, cachedInputTokens, generatedImages, id])
  }

  private async finish(job: ClaimedJob, result: 'done' | 'failed' | 'unknown', error: string | null, apply?: (state: DraftState) => void) {
    await this.database.transaction(async (connection) => {
      const [[draft]] = await connection.execute<DraftRow[]>(`SELECT ${draftFields} FROM ai_drafts WHERE id = ? FOR UPDATE`, [job.draftId])
      const [updated] = await connection.execute<ResultSetHeader>(`UPDATE ai_jobs SET status = ?, error_message = ?,
        payload = NULL, image_blob = IF(? = 'done', NULL, image_blob), finished_at = UTC_TIMESTAMP(3)
        WHERE id = ? AND status = 'running'`, [result, error, result, job.id])
      if (!draft || updated.affectedRows !== 1) return
      const state = parseJson(draft.state)
      if (state.lastOperation !== job.operationId) return
      if (apply) apply(state)
      else if (job.type === 'chat' && job.payload) {
        const input = parseJson<{ text: string }>(job.payload).text
        completeChat(state, job, input, error ?? '本轮对话未完成。')
      }
      state.version += 1
      await writeDraft(connection, draft, state)
    })
  }

  private async sweep(): Promise<void> {
    await this.database.execute(`UPDATE ai_jobs SET status = IF(image_blob IS NULL, 'unknown', 'failed'),
      error_message = IF(image_blob IS NULL, '处理进程中断，结果未知。', '处理进程中断，可以重试上传原图。'),
      payload = NULL, finished_at = UTC_TIMESTAMP(3) WHERE status = 'running' AND started_at < UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE`)
    await this.database.execute(`UPDATE ai_usage SET result = 'unknown', finished_at = UTC_TIMESTAMP(3)
      WHERE result = 'running' AND started_at < UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE`)
    await this.database.execute(`UPDATE ai_jobs SET status = 'failed', payload = NULL, image_blob = NULL,
      finished_at = UTC_TIMESTAMP(3), error_message = '草稿已过期。' WHERE status = 'queued' AND NOT EXISTS
      (SELECT 1 FROM ai_drafts WHERE id = ai_jobs.draft_id AND expires_at > UTC_TIMESTAMP(3))`)
    await this.database.execute('DELETE FROM ai_drafts WHERE expires_at <= UTC_TIMESTAMP(3) LIMIT 100')
    await this.database.execute(`DELETE FROM ai_jobs WHERE finished_at <= UTC_TIMESTAMP(3) - ${retention} LIMIT 100`)
    await this.assets.sweep()
  }
}
