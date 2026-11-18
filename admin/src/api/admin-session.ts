import { adminRequest } from './admin-request'

export interface AdminSession {
  username: string
  expiresAt: string
}

export interface AdminLogin {
  username: string
  password: string
}

export class AdminSessionError extends Error {
  constructor(readonly status: number) {
    super(`会话请求失败（${status}）`)
  }
}

async function sessionRequest(options: {
  method: string
  credentials?: AdminLogin
  signal: AbortSignal
}): Promise<Response> {
  const { method, credentials, signal } = options
  return adminRequest({ path: '/session', method, body: credentials, signal })
}

async function readSession(response: Response): Promise<AdminSession> {
  if (!response.ok) throw new AdminSessionError(response.status)
  const session: Partial<AdminSession> | null = await response.json()
  if (
    typeof session?.username !== 'string' ||
    typeof session.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(session.expiresAt))
  ) {
    throw new Error('服务返回了无效的会话。')
  }
  return {
    username: session.username,
    expiresAt: session.expiresAt,
  }
}

export async function getAdminSession(signal: AbortSignal): Promise<AdminSession | null> {
  const response = await sessionRequest({ method: 'GET', signal })
  return response.status === 401 ? null : readSession(response)
}

export async function loginAdmin(
  credentials: AdminLogin,
  signal: AbortSignal,
): Promise<AdminSession> {
  return readSession(await sessionRequest({ method: 'POST', credentials, signal }))
}

export async function logoutAdmin(signal: AbortSignal): Promise<void> {
  const response = await sessionRequest({ method: 'DELETE', signal })
  if (!response.ok && response.status !== 401) throw new AdminSessionError(response.status)
}
