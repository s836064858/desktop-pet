import { adminRequest } from './admin-request'

export interface TosSettings {
  bucket: string
  region: string
  accessKeyHint: string
  version: number
  updatedAt: string
}

export interface TosSettingsInput {
  bucket: string
  region: string
  accessKeyId: string
  accessKeySecret: string
  version: number
}

export class TosSettingsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function readSettings(response: Response): Promise<TosSettings | null> {
  if (!response.ok) {
    const payload: { message?: unknown } | null = await response.json().catch(() => null)
    throw new TosSettingsError(
      response.status,
      typeof payload?.message === 'string' ? payload.message : '暂时无法访问 TOS 配置。',
    )
  }
  const { settings } = (await response.json()) as { settings: TosSettings | null }
  return settings
}

export async function loadTosSettings(signal: AbortSignal): Promise<TosSettings | null> {
  return readSettings(await adminRequest({ path: '/ai/config/storage', method: 'GET', signal }))
}

export async function saveTosSettings(
  input: TosSettingsInput,
  signal: AbortSignal,
): Promise<TosSettings> {
  const response = await adminRequest({
    path: '/ai/config/storage',
    method: 'PUT',
    body: input,
    signal,
    timeoutMs: 30_000,
  })
  const settings = await readSettings(response)
  if (!settings) throw new Error('服务返回了空配置。')
  return settings
}
