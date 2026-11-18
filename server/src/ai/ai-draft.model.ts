import { BadRequestException } from '@nestjs/common'
import type { RowDataPacket } from 'mysql2/promise'
import { record, text } from './ai-input'

export const stages = ['juvenile', 'adult', 'full'] as const
export const frames = ['idle', 'happy', 'thirsty', 'water', 'sun', 'sleep'] as const
export type Stage = typeof stages[number]
export type Frame = typeof frames[number]
export type Target = `${Stage}:${Frame}`
export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'unknown'

export interface PlantPlan {
  name: string
  emoji: string
  desc: string
  stages: Record<Stage, string>
  states: Record<Frame, string>
  careProfile: { waterEveryDays: number; lightEveryDays: number; description: string }
}

export interface DraftState {
  version: number
  plan: PlantPlan | null
  isPlanReady: boolean
  reference: string | null
  messages: ChatMessage[]
  assets: Partial<Record<Target, string>>
  uploadRetries: Partial<Record<Target, string>>
  confirmed: Stage[]
  lastOperation: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  status: 'pending' | 'done' | 'error'
  hasImage?: boolean
  errorMessage?: string
  plan?: PlantPlan
  needsClarification?: boolean
}

export function preserveLegacyPlan(state: DraftState): void {
  if (!state.isPlanReady || !state.plan || state.messages.some((message) => message.plan)) return
  const reply = state.messages.filter((message) => message.role === 'assistant').at(-1)
  if (reply) reply.plan = state.plan
}

export function resolveInterruptedChat(state: DraftState, jobs: JobRow[]): void {
  const chat = jobs.find((job) => job.type === 'chat' && (job.status === 'failed' || job.status === 'unknown'))
  if (!chat) return
  state.messages = state.messages.map((message) => message.id === chat.operationId && message.status === 'pending'
    ? { ...message, status: 'error', errorMessage: chat.errorMessage ?? '本轮对话未完成。' } : message)
}

export interface DraftRow extends RowDataPacket {
  id: string
  userId: string
  state: DraftState | string
  expiresAt: Date
}

export interface JobRow extends RowDataPacket {
  id: string
  operationId: string
  draftId: string
  userId: string
  type: 'chat' | 'image'
  target: Target | 'chat'
  status: JobStatus
  payload: { text: string } | string | null
  errorMessage: string | null
}

export const draftFields = 'id, user_id AS userId, state, expires_at AS expiresAt'
export const jobFields = `id, operation_id AS operationId, draft_id AS draftId, user_id AS userId,
  type, target, status, payload, error_message AS errorMessage`
export const retention = 'INTERVAL 30 DAY'

export function parseJson<T>(value: T | string): T {
  return typeof value === 'string' ? JSON.parse(value) as T : value
}

export function newState(): DraftState {
  return { version: 0, plan: null, isPlanReady: false, reference: null, messages: [], assets: {}, uploadRetries: {}, confirmed: [], lastOperation: null }
}

export function parseStage(value: unknown): Stage {
  if (!stages.includes(value as Stage)) throw new BadRequestException('成长阶段无效。')
  return value as Stage
}

export function parseTarget(value: unknown): Target {
  const [stage, frame, extra] = typeof value === 'string' ? value.split(':') : []
  if (extra !== undefined || !frames.includes(frame as Frame)) throw new BadRequestException('图片状态无效。')
  return `${parseStage(stage)}:${frame as Frame}`
}

export function readReference(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > 8 * 1024 * 1024 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ||
      !Buffer.from(value.slice(22, 34), 'base64').subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new BadRequestException('参考图必须为有效 PNG，大小不超过 6 MB。')
  }
  return value
}

function readInterval(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 30) {
    throw new Error('养护间隔无效')
  }
  return value
}

function readFields<Key extends string>(value: unknown, keys: readonly Key[], limit: number) {
  const input = record(value)
  return Object.fromEntries(keys.map((key) => [key, text(input[key], limit, key)])) as Record<Key, string>
}

export function readPlanReply(output: string): { reply: string; plan: PlantPlan | null } {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  const parsed = record(JSON.parse(output.slice(start, end + 1)))
  const reply = text(parsed.reply, 1600, '植物创作回复')
  if (parsed.needsClarification === true) return { reply, plan: null }
  if (parsed.needsClarification !== false) throw new Error('植物档案状态无效')
  const plan = record(parsed.plan)
  const care = record(plan.careProfile)
  return { reply, plan: {
    name: text(plan.name, 12, '植物名称'), emoji: text(plan.emoji, 16, '植物图标'),
    desc: text(plan.desc, 120, '植物外形'), stages: readFields(plan.stages, stages, 200),
    states: readFields(plan.states, frames, 100), careProfile: {
      waterEveryDays: readInterval(care.waterEveryDays), lightEveryDays: readInterval(care.lightEveryDays),
      description: text(care.description, 800, '习性介绍'),
    },
  } }
}

export function acceptPlan(state: DraftState, plan: PlantPlan): void {
  const previous = state.plan
  for (const stage of stages) {
    if (!previous || previous.desc !== plan.desc || previous.states.idle !== plan.states.idle ||
      previous.stages[stage] !== plan.stages[stage]) {
      invalidateStage(state, stage)
    } else {
      for (const frame of frames) {
        if (previous.states[frame] === plan.states[frame]) continue
        delete state.assets[`${stage}:${frame}`]
        delete state.uploadRetries[`${stage}:${frame}`]
      }
    }
  }
  state.plan = plan
  state.isPlanReady = true
}

export function invalidateStage(state: DraftState, stage: Stage): void {
  state.confirmed = state.confirmed.filter((item) => item !== stage)
  for (const frame of frames) {
    delete state.assets[`${stage}:${frame}`]
    delete state.uploadRetries[`${stage}:${frame}`]
  }
}
