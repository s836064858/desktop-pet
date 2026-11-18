import type { RowDataPacket } from 'mysql2/promise'
import type { DatabaseService } from '../database/database.service'
import { DEFAULT_ADMIN_USERNAME } from './admin-password'

export function readDefaultAdminHash(): string | undefined {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim()
  if (hash && !/^[a-f\d]{32}\.[a-f\d]{128}$/.test(hash)) {
    throw new Error('ADMIN_PASSWORD_HASH 格式无效。')
  }
  return hash || undefined
}

export async function seedDefaultAdmin(database: DatabaseService, hash?: string): Promise<boolean> {
  if (!hash) {
    const [row] = await database.execute<(RowDataPacket & { hasPassword: number })[]>(
      "SELECT password_hash <> '' AS hasPassword FROM admins WHERE username = ?",
      [DEFAULT_ADMIN_USERNAME],
    )
    return Boolean(row?.hasPassword)
  }

  await database.execute(
    `INSERT INTO admins (username, password_hash) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       auth_version = auth_version + (BINARY password_hash <> BINARY VALUES(password_hash)),
       password_hash = VALUES(password_hash),
       must_change_password = 0`,
    [DEFAULT_ADMIN_USERNAME, hash],
  )
  return true
}
