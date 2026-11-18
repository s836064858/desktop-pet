import { BadGatewayException, BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { DatabaseService } from '../database/database.service'
import { decryptConfig, encryptConfig } from '../tos-storage/tos-credentials'
import { record, revision } from './ai-input'
import { verifyArkChat } from './ark-provider'

interface SettingsRow extends RowDataPacket {
  credentials: Buffer | null
  isPaused: number
  version: number
}

const context = Buffer.from('sproutkin:ark-credentials:v1')
export const aiSettingsFields = 'credentials, is_paused AS isPaused, version'

@Injectable()
export class AiSettingsService {
  private isVerifying = false

  constructor(private readonly database: DatabaseService) {}

  async summary() {
    const [row] = await this.database.execute<SettingsRow[]>(`SELECT ${aiSettingsFields} FROM ai_settings WHERE id = 1`)
    if (!row) throw new ServiceUnavailableException('请先执行数据库迁移。')
    return { hasArkKey: Boolean(row.credentials), isPaused: Boolean(row.isPaused), version: row.version }
  }

  async saveArk(body: unknown) {
    const { key, version } = record(body)
    const expected = revision(version)
    if (typeof key !== 'string' || !/^[!-~]{12,256}$/.test(key)) {
      throw new BadRequestException('请填写有效的方舟 API Key。')
    }
    if (this.isVerifying || (await this.summary()).version !== expected) throw this.conflict()
    if (this.isVerifying) throw this.conflict()
    this.isVerifying = true
    try {
      const credentials = encryptConfig({ key }, context)
      await verifyArkChat(key).catch(() => {
        throw new BadGatewayException('方舟对话验证失败，请检查 Key、模型权限或连接后重试。')
      })
      await this.update('credentials', credentials, expected)
      return await this.summary()
    } finally {
      this.isVerifying = false
    }
  }

  async savePause(body: unknown) {
    const { isPaused, version } = record(body)
    if (typeof isPaused !== 'boolean') throw new BadRequestException('服务状态无效。')
    await this.update('is_paused', Number(isPaused), revision(version))
    return this.summary()
  }

  openKey(credentials: Buffer): string {
    return decryptConfig<{ key: string }>(credentials, context).key
  }

  private async update(field: 'credentials' | 'is_paused', value: Buffer | number, version: number) {
    const result = await this.database.execute<ResultSetHeader>(
      `UPDATE ai_settings SET ${field} = ?, version = version + 1 WHERE id = 1 AND version = ?`, [value, version],
    )
    if (result.affectedRows !== 1) throw this.conflict()
  }

  private conflict() {
    return new ConflictException('设置已变化或正在验证，请重新加载。')
  }
}
