import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { QueryResult, RowDataPacket } from 'mysql2/promise'
import { DatabaseService } from '../database/database.service'
import {
  DEFAULT_ADMIN_USERNAME,
  hashAdminPassword,
  isAdminUsername,
  isNewAdminPassword,
  normalizeAdminUsername,
} from './admin-password'

interface AdminUserRow extends RowDataPacket {
  id: number
  username: string
  isEnabled: number
}

interface AdminUser {
  id: number
  username: string
  isEnabled: boolean
  isDefault: boolean
}

const ACCOUNT_FIELDS = 'id, username, is_enabled AS isEnabled'

function requirePassword(value: unknown): string {
  if (!isNewAdminPassword(value)) throw new BadRequestException('新密码需为 12–128 个字符。')
  return value
}

function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    isEnabled: Boolean(row.isEnabled),
    isDefault: row.username === DEFAULT_ADMIN_USERNAME,
  }
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly database: DatabaseService) {}

  async list(): Promise<AdminUser[]> {
    const rows = await this.execute<AdminUserRow[]>(
      `SELECT ${ACCOUNT_FIELDS} FROM admins ORDER BY (username = ?) DESC, username`,
      [DEFAULT_ADMIN_USERNAME],
    )
    return rows.map(toAdminUser)
  }

  async create(body: { username?: unknown; password?: unknown } | null): Promise<void> {
    const username = typeof body?.username === 'string' ? normalizeAdminUsername(body.username) : ''
    if (!isAdminUsername(username))
      throw new BadRequestException('账号需为 3–48 位字母、数字、点、下划线或连字符。')
    const passwordHash = await hashAdminPassword(requirePassword(body?.password))
    await this.execute(
      'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      [username, passwordHash],
    )
  }

  async setEnabled(id: number, isEnabled: unknown): Promise<void> {
    if (typeof isEnabled !== 'boolean') throw new BadRequestException('账号状态无效。')
    await this.requireManagedUser(id)
    const next = Number(isEnabled)
    await this.execute(
      `UPDATE admins SET is_enabled = ?, auth_version = auth_version + 1
       WHERE id = ? AND is_enabled <> ?`,
      [next, id, next],
    )
  }

  async resetPassword(id: number, password: unknown): Promise<void> {
    const nextPassword = requirePassword(password)
    await this.requireManagedUser(id)
    await this.execute(
      `UPDATE admins SET password_hash = ?, auth_version = auth_version + 1
       WHERE id = ?`,
      [await hashAdminPassword(nextPassword), id],
    )
  }

  private async requireManagedUser(id: number): Promise<void> {
    const [row] = await this.execute<AdminUserRow[]>(
      `SELECT ${ACCOUNT_FIELDS} FROM admins WHERE id = ?`,
      [id],
    )
    if (!row) throw new NotFoundException('该后台账号不存在。')
    if (row.username === DEFAULT_ADMIN_USERNAME)
      throw new ForbiddenException('默认管理员由服务端配置管理。')
  }

  private async execute<T extends QueryResult>(
    sql: string,
    values: (string | number)[],
  ): Promise<T> {
    try {
      return await this.database.execute<T>(sql, values)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('该后台账号已存在。')
      }
      throw new ServiceUnavailableException('暂时无法访问后台账号，请稍后重试。')
    }
  }
}
