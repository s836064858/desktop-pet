import type { Request } from 'express'

function readAdminOrigin(): string {
  const value = process.env.ADMIN_ORIGIN ?? 'http://127.0.0.1:5180'
  if (!/^https?:\/\/[^\s/?#@\\]+\/?$/i.test(value) || !URL.canParse(value)) {
    throw new Error('ADMIN_ORIGIN 必须为完整的 HTTP(S) Origin，不能包含路径、参数或凭证。')
  }
  return new URL(value).origin
}

export const ADMIN_ORIGIN = readAdminOrigin()
export const ADMIN_SESSION_COOKIE = 'sproutkin_admin_session'
export const adminCookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: ADMIN_ORIGIN.startsWith('https://'),
  path: '/api/admin',
} as const

export function readAdminSessionToken(request: Request): string | undefined {
  const prefix = `${ADMIN_SESSION_COOKIE}=`
  const cookies = (request.headers.cookie ?? '').split(';')
  const cookie = cookies.map((value) => value.trim()).find((value) => value.startsWith(prefix))
  const token = cookie?.slice(prefix.length)
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined
}
