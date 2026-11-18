import { adminRequest } from './admin-request'

export interface AiConfig { hasArkKey: boolean; isPaused: boolean; version: number }
export interface Invite {
  id: string
  code: string | null
  label: string
  userId: string | null
  nickname: string | null
  isAiDisabled: boolean | null
  userRevokedAt: string | null
  expiresAt: string | null
  redeemedAt: string | null
  revokedAt: string | null
}
export interface IssueInvitesInput {
  count: number
  days: number
  userId?: string
}
export interface IssuedInvite {
  id: string
  code: string
  expiresAt: string
}
export interface UsageDay {
  day: string
  requests: number
  images: number
  failures: number
  unknowns: number
  inputTokens: number | null
  outputTokens: number | null
  cachedInputTokens: number | null
  cost: string | null
  unpriced: number
}
export interface UsageCall {
  id: string
  name: string
  type: 'chat' | 'image'
  result: 'running' | 'success' | 'failed' | 'unknown'
  model: string
  inputTokens: number | null
  outputTokens: number | null
  cachedInputTokens: number | null
  images: number | null
  cost: string | null
  startedAt: string
  jobStatus: string | null
}
export type ModelPrice = { type: 'image'; model: string; perImage: number } |
  { type: 'chat'; model: string; inputPerMillion: number; outputPerMillion: number; cachedInputPerMillion: number }
export interface UsageReport { trend: UsageDay[]; calls: UsageCall[]; pricing: ModelPrice[] }

export class AiAdminError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export async function aiAdmin<T>(path: string, signal: AbortSignal, method = 'GET', body?: object): Promise<T> {
  const response = await adminRequest({ path: `/ai${path}`, method, signal, body, timeoutMs: 22_000 })
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: unknown } | null
    throw new AiAdminError(response.status, response.status !== 500 && typeof error?.message === 'string'
      ? error.message : '操作未完成，请检查服务连接后重试。')
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}
