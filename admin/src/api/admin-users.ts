import { adminRequest } from './admin-request'

export const DEFAULT_ADMIN_USERNAME = 'admin'

export interface AdminUser {
  id: number
  username: string
  isEnabled: boolean
  isDefault: boolean
}
export class AdminUsersError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function requireSuccess(response: Response): Promise<Response> {
  if (response.ok) return response
  const body: { message?: unknown } | null = await response.json().catch(() => null)
  throw new AdminUsersError(
    response.status,
    typeof body?.message === 'string' ? body.message : '后台请求失败，请稍后重试。',
  )
}

export async function listAdminUsers(signal: AbortSignal): Promise<AdminUser[]> {
  const response = await requireSuccess(
    await adminRequest({ path: '/users', method: 'GET', signal }),
  )
  const { users } = (await response.json()) as { users: AdminUser[] }
  return users
}

export async function createAdminUser(
  body: { username: string; password: string },
  signal: AbortSignal,
): Promise<void> {
  await requireSuccess(await adminRequest({ path: '/users', method: 'POST', body, signal }))
}

export async function setAdminEnabled(
  id: number,
  isEnabled: boolean,
  signal: AbortSignal,
): Promise<void> {
  await requireSuccess(
    await adminRequest({ path: `/users/${id}/status`, method: 'PUT', body: { isEnabled }, signal }),
  )
}

export async function resetAdminPassword(
  id: number,
  password: string,
  signal: AbortSignal,
): Promise<void> {
  await requireSuccess(
    await adminRequest({
      path: `/users/${id}/password`,
      method: 'PUT',
      body: { password },
      signal,
    }),
  )
}
