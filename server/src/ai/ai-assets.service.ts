import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { DatabaseService } from '../database/database.service'
import { decryptTosCredentials } from '../tos-storage/tos-credentials'
import { deleteGeneratedPng, readGeneratedPng, storeGeneratedPng } from '../tos-storage/tos-object-store'
import { retention } from './ai-draft.model'
import { uuid } from './ai-input'

interface AssetRow extends RowDataPacket {
  id: string
  bucket: string
  region: string
  credentials: Buffer
  objectKey: string
  byteLength: number
  versionId: string | null
}

const selectAsset = `SELECT asset.id, target.bucket, target.region, target.credentials,
  asset.object_key AS objectKey, asset.byte_length AS byteLength, asset.version_id AS versionId
  FROM ai_assets asset JOIN ai_storage_targets target ON target.version = asset.target_version`

function targetFor(row: AssetRow) {
  return { bucket: row.bucket, region: row.region, ...decryptTosCredentials(row.credentials) }
}

@Injectable()
export class AiAssetsService {
  constructor(private readonly database: DatabaseService) {}

  async upload(id: string, userId: string, bytes: Buffer): Promise<void> {
    await this.database.transaction(async (connection) => {
      await connection.execute(`INSERT IGNORE INTO ai_storage_targets (version, bucket, region, credentials)
        SELECT version, bucket, region, credentials FROM tos_settings WHERE id = 1`)
      await connection.execute(`INSERT IGNORE INTO ai_assets (id, user_id, target_version, object_key, download_url, byte_length, expires_at)
        SELECT ?, ?, version, ?, ?, ?, UTC_TIMESTAMP(3) + ${retention} FROM tos_settings WHERE id = 1`,
      [id, userId, `sproutkin/generated/${id}.png`, `/api/v1/ai/assets/${id}`, bytes.length])
    })
    const [asset] = await this.database.execute<AssetRow[]>(`${selectAsset} WHERE asset.id = ?`, [id])
    if (!asset) throw new ServiceUnavailableException('尚未配置 TOS。')
    const location = await storeGeneratedPng({ target: targetFor(asset), assetId: id, bytes })
    await this.database.execute('UPDATE ai_assets SET is_ready = 1, version_id = ? WHERE id = ?', [location.versionId ?? null, id])
  }

  async read(userId: string, id: string): Promise<Buffer> {
    const [asset] = await this.database.execute<AssetRow[]>(`${selectAsset}
      WHERE asset.user_id = ? AND asset.id = ? AND asset.is_ready = 1 AND asset.expires_at > UTC_TIMESTAMP(3)`, [userId, uuid(id)])
    if (!asset) throw new NotFoundException('素材不存在、已过期或尚未上传。')
    return readGeneratedPng(targetFor(asset), asset.objectKey, asset.byteLength, asset.versionId ?? undefined)
  }

  async sweep(): Promise<void> {
    const assets = await this.database.execute<AssetRow[]>(`${selectAsset}
      WHERE asset.expires_at <= UTC_TIMESTAMP(3) ORDER BY asset.expires_at LIMIT 4`)
    for (const asset of assets) {
      const result = await this.database.execute<ResultSetHeader>(`UPDATE ai_assets SET is_ready = 2
        WHERE id = ? AND expires_at <= UTC_TIMESTAMP(3) AND NOT EXISTS
        (SELECT 1 FROM ai_jobs WHERE id = ai_assets.id AND status = 'running')`, [asset.id])
      if (!result.affectedRows) continue
      try {
        await deleteGeneratedPng(targetFor(asset), asset.objectKey, asset.versionId ?? undefined)
      } catch {
        continue
      }
      await this.database.execute('DELETE FROM ai_assets WHERE id = ? AND is_ready = 2', [asset.id])
    }
    await this.database.execute(`DELETE FROM ai_storage_targets WHERE NOT EXISTS
      (SELECT 1 FROM ai_assets WHERE target_version = ai_storage_targets.version)
      AND NOT EXISTS (SELECT 1 FROM tos_settings WHERE version = ai_storage_targets.version)`)
  }
}
