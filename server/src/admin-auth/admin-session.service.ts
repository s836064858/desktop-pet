import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import type { QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { DatabaseService } from '../database/database.service'
import { isAdminUsername, normalizeAdminUsername, verifyAdminPassword } from './admin-password'

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000
const LOGIN_WINDOW_MS = 60 * 1000
const MAX_LOGIN_ATTEMPTS = 10

interface AdminCredentialsRow extends RowDataPacket {
  id: number
  username: string
  passwordHash: string
  authVersion: number
}

interface AdminSessionRow extends RowDataPacket {
  username: string
  expiresAt: Date
}

export interface AdminSession {
  username: string
  expiresAt: string
}

function validateLogin(body: unknown): { username: string; password: string } {
  const input = body as Partial<Record<'username' | 'password', unknown>> | null | undefined
  const username = typeof input?.username === 'string' ? normalizeAdminUsername(input.username) : ''
  const password = input?.password
  if (
    !isAdminUsername(username) ||
    typeof password !== 'string' ||
    !password ||
    password.length > 128
  ) {
    throw new BadRequestException('请输入有效的管理员账号和密码。')
  }
  return { username, password }
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest()
}

@Injectable()
export class AdminSessionService {
  private loginWindowEndsAt = 0
  private loginAttempts = 0

  constructor(private readonly database: DatabaseService) {}

  async login(body: unknown): Promise<{ token: string; session: AdminSession }> {
    const { username, password } = validateLogin(body)
    this.takeLoginAttempt()
    const [admin] = await this.execute<AdminCredentialsRow[]>(
      `SELECT id, username, password_hash AS passwordHash, auth_version AS authVersion
       FROM admins WHERE username = ? AND is_enabled = 1`,
      [username],
    )
    const hasValidPassword = await verifyAdminPassword(password, admin?.passwordHash)
    if (!hasValidPassword || !admin) throw new UnauthorizedException('账号或密码错误。')

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
    await this.execute('DELETE FROM admin_sessions WHERE expires_at <= UTC_TIMESTAMP(3)')
    const result = await this.execute<ResultSetHeader>(
      `INSERT INTO admin_sessions (token_hash, admin_id, expires_at, auth_version)
       SELECT ?, id, ?, auth_version FROM admins WHERE id = ? AND is_enabled = 1 AND auth_version = ?`,
      [hashToken(token), expiresAt, admin.id, admin.authVersion],
    )
    if (result.affectedRows !== 1) throw new UnauthorizedException('账号状态已变化，请重新登录。')
    return {
      token,
      session: {
        username: admin.username,
        expiresAt: expiresAt.toISOString(),
      },
    }
  }

  async requireSession(token: string): Promise<AdminSession> {
    const [session] = await this.execute<AdminSessionRow[]>(
      `SELECT admins.username, admin_sessions.expires_at AS expiresAt
       FROM admin_sessions INNER JOIN admins ON admins.id = admin_sessions.admin_id
       WHERE admin_sessions.token_hash = ? AND admin_sessions.expires_at > UTC_TIMESTAMP(3)
       AND admins.is_enabled = 1 AND admin_sessions.auth_version = admins.auth_version`,
      [hashToken(token)],
    )
    if (!session) throw new UnauthorizedException('登录已失效，请重新登录。')
    return {
      username: session.username,
      expiresAt: session.expiresAt.toISOString(),
    }
  }

  async revokeSession(token: string): Promise<void> {
    await this.execute('DELETE FROM admin_sessions WHERE token_hash = ?', [hashToken(token)])
  }

  private takeLoginAttempt(): void {
    const now = Date.now()
    if (now >= this.loginWindowEndsAt) {
      this.loginWindowEndsAt = now + LOGIN_WINDOW_MS
      this.loginAttempts = 0
    }
    if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      throw new HttpException('登录尝试过于频繁，请稍后重试。', HttpStatus.TOO_MANY_REQUESTS)
    }
    this.loginAttempts += 1
  }

  private async execute<T extends QueryResult>(
    sql: string,
    values?: (string | number | Buffer | Date)[],
  ): Promise<T> {
    try {
      return await this.database.execute<T>(sql, values)
    } catch {
      throw new ServiceUnavailableException('暂时无法读取管理员会话，请稍后重试。')
    }
  }
}
