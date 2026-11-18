import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { ensureAiToken } from './aiDeviceVault'
import type { GrowthStage } from './growth'
import type { PlantChatMessage, PlantPlan } from './plantPlan'
import type { FrameName } from './spriteFrames'

export type AiSlot = `${GrowthStage}:${FrameName}`
export interface AiJob {
  id: string
  type: 'chat' | 'image'
  target: AiSlot | 'chat'
  status: 'queued' | 'running' | 'done' | 'failed' | 'unknown'
  errorMessage: string | null
  canRetryUpload: boolean
  isUploadOnly?: boolean
}

export interface AiDraft {
  id: string
  version: number
  plan: PlantPlan | null
  isPlanReady: boolean
  hasReference: boolean
  messages: PlantChatMessage[]
  assets: Partial<Record<AiSlot, string>>
  uploadRetries: Partial<Record<AiSlot, string>>
  confirmed: GrowthStage[]
  lastOperation: string | null
  jobs: AiJob[]
}

export class AiServiceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function request(options: { path: string; token?: string; method?: string; body?: object; signal: AbortSignal }) {
  const { path, token, method = 'GET', body, signal } = options
  signal.throwIfAborted()
  let response: Response
  try {
    response = await tauriFetch(__AI_API_BASE_URL__ + path, {
      method, body: body && JSON.stringify(body),
      headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), maxRedirections: 0,
    })
  } catch {
    signal.throwIfAborted()
    throw new AiServiceError(0, '无法连接 AI 服务或请求超时，请重试。')
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: unknown } | null
    throw new AiServiceError(response.status, typeof error?.message === 'string' && error.message.length <= 240 && response.status !== 500
      ? error.message : 'AI 服务暂时无法完成请求。')
  }
  return response
}

export async function activateAi(options: { code: string; name: string; signal: AbortSignal }) {
  const token = await ensureAiToken()
  await request({ path: '/activate', method: 'POST', body: { code: options.code, name: options.name, token }, signal: options.signal })
  return token
}

export function aiClient(token: string) {
  async function get<T>(path: string, signal: AbortSignal): Promise<T> {
    const response = await request({ path, token, signal })
    return response.json() as Promise<T>
  }
  return {
    status: (signal: AbortSignal) => get<{ name: string; isPaused: boolean; isAiDisabled?: boolean }>('/status', signal),
    draft: (signal: AbortSignal) => get<AiDraft>('/draft', signal),
    reference: (signal: AbortSignal) => get<{ image: string | null }>('/draft/reference', signal),
    update: (body: object, signal: AbortSignal) => request({ path: '/draft', method: 'PATCH', body, signal, token }),
    submit: (body: object, signal: AbortSignal) => request({ path: '/jobs', method: 'POST', body, signal, token }),
    async download(id: string, signal: AbortSignal) {
      const response = await request({ path: `/assets/${encodeURIComponent(id)}`, token, signal })
      return new Uint8Array(await response.arrayBuffer())
    },
  }
}

export function aiWait(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, 1500)
    function finish() {
      signal.removeEventListener('abort', cancel)
      resolve()
    }
    function cancel() {
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      reject(signal.reason)
    }
    signal.addEventListener('abort', cancel, { once: true })
  })
}
