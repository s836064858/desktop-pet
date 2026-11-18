import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { DatabaseService } from '../database/database.service'
import { decryptTosCredentials, encryptTosCredentials } from './tos-credentials'
import { verifyTosTarget } from './tos-object-store'
import type { TosLocation, TosTarget } from './tos-object-store'

interface TosSettingsRow extends RowDataPacket, TosLocation {
  credentials: Buffer
  accessKeyHint: string
  version: number
  updatedAt: Date
}

interface TosSettings extends TosLocation {
  accessKeyHint: string
  version: number
  updatedAt: string
}

function readText(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  return typeof value === 'string' ? value.trim() : ''
}

function parseSettings(body: unknown): { target: TosTarget; version: number } {
  if (!body || typeof body !== 'object') throw new BadRequestException('请填写 TOS 配置。')
  const input = body as Record<string, unknown>
  const bucket = readText(input, 'bucket')
  const region = readText(input, 'region')
  if (!/^[a-z\d][a-z\d-]{1,61}[a-z\d]$/.test(bucket)) {
    throw new BadRequestException('存储桶名称需为 3–63 位小写字母、数字或连字符。')
  }
  if (region.length > 32 || !/^[a-z]{2}(?:-[a-z\d]+)+$/.test(region)) {
    throw new BadRequestException('请输入有效的地域 ID，例如 cn-beijing。')
  }

  const accessKeyId = readText(input, 'accessKeyId')
  const accessKeySecret = readText(input, 'accessKeySecret')
  if (!/^[\x21-\x7e]{5,128}$/.test(accessKeyId) || !/^[\x21-\x7e]{1,256}$/.test(accessKeySecret)) {
    throw new BadRequestException('请填写有效的 AccessKey ID 和 AccessKey Secret。')
  }
  const version = input.version
  if (
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    version >= 2 ** 32 - 1
  ) {
    throw new BadRequestException('配置版本无效，请重新加载。')
  }
  return { target: { bucket, region, accessKeyId, accessKeySecret }, version }
}

function settingsConflict(): ConflictException {
  return new ConflictException('配置已被更新，请重新加载后再保存。')
}

@Injectable()
export class TosSettingsService {
  private isSaving = false

  constructor(private readonly database: DatabaseService) {}

  async getSettings(): Promise<TosSettings | null> {
    const row = await this.readActive()
    if (!row) return null
    const { bucket, region, accessKeyHint, version, updatedAt } = row
    return { bucket, region, accessKeyHint, version, updatedAt: updatedAt.toISOString() }
  }

  async saveSettings(body: unknown): Promise<TosSettings> {
    if (this.isSaving) throw new ConflictException('正在验证 TOS 配置，请稍后重试。')
    const { target, version } = parseSettings(body)
    this.isSaving = true
    try {
      const current = await this.readActive()
      if ((current?.version ?? 0) !== version) throw settingsConflict()
      const { bucket, region, accessKeyId, accessKeySecret } = target
      const credentials = encryptTosCredentials({ accessKeyId, accessKeySecret })
      await verifyTosTarget(target)
      const accessKeyHint = accessKeyId.slice(-4)
      const updatedAt = new Date()
      await this.writeSettings({ bucket, region, credentials, accessKeyHint, version, updatedAt })
      return {
        bucket,
        region,
        accessKeyHint,
        version: version + 1,
        updatedAt: updatedAt.toISOString(),
      }
    } finally {
      this.isSaving = false
    }
  }

  async requireTarget(): Promise<TosTarget> {
    const row = await this.readActive()
    if (!row) throw new ServiceUnavailableException('请先在管理后台配置 TOS。')
    return { bucket: row.bucket, region: row.region, ...decryptTosCredentials(row.credentials) }
  }

  private async readActive(): Promise<TosSettingsRow | undefined> {
    try {
      const [row] = await this.database.execute<TosSettingsRow[]>(
        `SELECT bucket, region, credentials, access_key_hint AS accessKeyHint, version, updated_at AS updatedAt
         FROM tos_settings WHERE id = 1`,
      )
      return row
    } catch {
      throw new ServiceUnavailableException('暂时无法读取 TOS 配置。')
    }
  }

  private async writeSettings(options: {
    bucket: string
    region: string
    credentials: Buffer
    accessKeyHint: string
    version: number
    updatedAt: Date
  }): Promise<void> {
    const { bucket, region, credentials, accessKeyHint, version, updatedAt } = options
    const values = [bucket, region, credentials, accessKeyHint, updatedAt]
    let result: ResultSetHeader
    try {
      result =
        version === 0
          ? await this.database.execute<ResultSetHeader>(
              `INSERT INTO tos_settings (id, bucket, region, credentials, access_key_hint, updated_at, version)
             VALUES (1, ?, ?, ?, ?, ?, 1)`,
              values,
            )
          : await this.database.execute<ResultSetHeader>(
              `UPDATE tos_settings SET bucket = ?, region = ?, credentials = ?, access_key_hint = ?,
             updated_at = ?, version = version + 1 WHERE id = 1 AND version = ?`,
              [...values, version],
            )
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        throw settingsConflict()
      }
      throw new ServiceUnavailableException('暂时无法保存 TOS 配置。')
    }
    if (result.affectedRows !== 1) throw settingsConflict()
  }
}
