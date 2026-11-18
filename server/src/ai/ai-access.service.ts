import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { DatabaseService } from '../database/database.service'
import { decryptConfig, encryptConfig } from '../tos-storage/tos-credentials'
import { record, text, uuid } from './ai-input'

interface InviteRow extends RowDataPacket {
  id: string
  label: string
  userId: string | null
  redeemedToken: Buffer | null
  expiresAt: Date
  redeemedAt: Date | null
  revokedAt: Date | null
}

interface IdentityRow extends RowDataPacket {
  id: string
  label: string
  tokenHash: Buffer
  revokedAt: Date | null
  isAiDisabled: number
}

interface InviteListRow extends RowDataPacket {
  id: string
  nickname: string | null
  isAiDisabled: number | null
  codeCipher: Buffer | null
}

const inviteFields = `id, label, user_id AS userId, expires_at AS expiresAt,
  redeemed_at AS redeemedAt, revoked_at AS revokedAt`

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function inviteContext(id: string): Buffer {
  return Buffer.from(`sproutkin:invite-code:v1:${id}`)
}

function isToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function readInviteIssue(input: Record<string, unknown>) {
  const { days, count } = input
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 30) {
    throw new BadRequestException('有效期需为 1–30 天。')
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 50) {
    throw new BadRequestException('生成数量需为 1–50 个。')
  }
  const userId = input.userId == null ? null : uuid(input.userId)
  if (userId && count !== 1) throw new BadRequestException('换机邀请每次只能生成 1 个。')
  return { days, count, userId }
}

@Injectable()
export class AiAccessService {
  private activationWindow = 0
  private activationCount = 0

  constructor(private readonly database: DatabaseService) {}

  async list(canReadCodes: boolean) {
    const rows = await this.database.execute<InviteListRow[]>(`SELECT invite.id, invite.label, invite.user_id AS userId,
      invite.created_at AS createdAt, invite.expires_at AS expiresAt, invite.redeemed_at AS redeemedAt,
      invite.revoked_at AS revokedAt, identity.label AS nickname, identity.is_ai_disabled AS isAiDisabled,
      identity.revoked_at AS userRevokedAt, ${canReadCodes ? 'invite.code_cipher' : 'NULL'} AS codeCipher
      FROM ai_invites AS invite LEFT JOIN ai_users AS identity ON identity.id = invite.user_id
      ORDER BY invite.created_at DESC, invite.id DESC LIMIT 200`)
    return rows.map(({ codeCipher, ...row }) => ({
      ...row,
      code: codeCipher ? decryptConfig<{ code: string }>(codeCipher, inviteContext(row.id)).code : null,
      isAiDisabled: row.isAiDisabled === null ? null : Boolean(row.isAiDisabled),
    }))
  }

  async updateNote(id: string, body: unknown): Promise<void> {
    const inviteId = uuid(id)
    const { label } = record(body)
    if (typeof label !== 'string' || label.trim().length > 48) {
      throw new BadRequestException('邀请备注最多 48 字，可留空。')
    }
    const result = await this.database.execute<ResultSetHeader>(
      'UPDATE ai_invites SET label = ? WHERE id = ?', [label.trim(), inviteId],
    )
    if (result.affectedRows !== 1) throw new NotFoundException('邀请码不存在。')
  }

  async setUserStatus(id: string, body: unknown): Promise<void> {
    const userId = uuid(id)
    const { isAiDisabled } = record(body)
    if (typeof isAiDisabled !== 'boolean') throw new BadRequestException('AI 停用状态无效。')
    await this.database.transaction(async (connection) => {
      const identity = await this.requireIdentity(connection, userId)
      if (identity.revokedAt) throw new ConflictException('该 AI 身份已撤销，无法修改 AI 状态。')
      await connection.execute('UPDATE ai_users SET is_ai_disabled = ? WHERE id = ?', [Number(isAiDisabled), userId])
    })
  }

  async issue(body: unknown) {
    const [invite] = await this.issueBatch({ ...record(body), count: 1 })
    return invite
  }

  async issueBatch(body: unknown) {
    const { days, count, userId } = readInviteIssue(record(body))
    const expiresAt = new Date(Date.now() + days * 86_400_000)
    const invites = Array.from({ length: count }, () => ({
      id: randomUUID(),
      code: randomBytes(16).toString('hex'),
      expiresAt,
    }))
    const values = invites.map(() => "(?, ?, ?, '', ?, UTC_TIMESTAMP(3), ?)").join(', ')
    const params = invites.flatMap(({ id, code }) => [
      id, digest(code), encryptConfig({ code }, inviteContext(id)), userId, expiresAt,
    ])
    await this.database.transaction(async (connection) => {
      if (userId) {
        const identity = await this.requireIdentity(connection, userId)
        if (identity.revokedAt) throw new ConflictException('该 AI 身份已撤销，无法发放换机邀请。')
      }
      await connection.execute(`INSERT INTO ai_invites
        (id, code_hash, code_cipher, label, user_id, created_at, expires_at) VALUES ${values}`, params)
    })
    return invites
  }

  async revoke(id: string): Promise<void> {
    await this.database.transaction(async (connection) => {
      const [[invite]] = await connection.execute<InviteRow[]>(
        `SELECT ${inviteFields} FROM ai_invites WHERE id = ? FOR UPDATE`, [uuid(id)],
      )
      if (!invite) throw new NotFoundException('邀请码不存在。')
      if (invite.revokedAt) return
      if (invite.userId && invite.redeemedAt) {
        await this.requireIdentity(connection, invite.userId)
        await connection.execute('UPDATE ai_users SET revoked_at = UTC_TIMESTAMP(3) WHERE id = ?', [invite.userId])
        await connection.execute(`UPDATE ai_jobs SET status = 'failed', payload = NULL, image_blob = NULL,
          error_message = 'AI 身份已撤销。', finished_at = UTC_TIMESTAMP(3)
          WHERE user_id = ? AND status = 'queued'`, [invite.userId])
      }
      await connection.execute('UPDATE ai_invites SET revoked_at = UTC_TIMESTAMP(3) WHERE id = ?', [invite.id])
    })
  }

  async activate(body: unknown) {
    this.limitActivation()
    const input = record(body)
    const label = text(input.name, 48, '昵称')
    const code = text(input.code, 64, '邀请码').toLowerCase()
    if (!/^[a-f0-9]{32}$/.test(code) || !isToken(input.token)) {
      throw new BadRequestException('邀请码或激活凭证格式无效。')
    }
    const tokenHash = digest(input.token)
    return this.database.transaction(async (connection) => {
      const [[invite]] = await connection.execute<InviteRow[]>(`SELECT ${inviteFields},
        redeemed_token_hash AS redeemedToken FROM ai_invites WHERE code_hash = ? FOR UPDATE`, [digest(code)])
      if (!invite || invite.revokedAt) throw new BadRequestException('邀请码无效或已撤销。')
      if (invite.redeemedAt) return this.resumeActivation(connection, invite, tokenHash)
      if (invite.expiresAt.getTime() <= Date.now()) throw new BadRequestException('邀请码已过期。')
      if (invite.userId) await this.requireActiveIdentity(connection, invite.userId)
      const id = invite.userId ?? randomUUID()
      await connection.execute(`INSERT INTO ai_users (id, label, token_hash) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE label = IF(id = VALUES(id), VALUES(label), label),
        token_hash = IF(id = VALUES(id), VALUES(token_hash), token_hash)`, [id, label, tokenHash])
      const identity = await this.requireActiveIdentity(connection, id)
      if (!identity.tokenHash.equals(tokenHash)) throw new ConflictException('激活凭证已被使用。')
      await connection.execute(`UPDATE ai_invites SET user_id = ?, redeemed_token_hash = ?,
        redeemed_at = UTC_TIMESTAMP(3) WHERE id = ?`, [id, tokenHash, invite.id])
      return { id, name: identity.label }
    })
  }

  async authenticate(authorization: string | undefined) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
    if (!isToken(token)) throw new UnauthorizedException('请先激活 AI。')
    const tokenHash = digest(token)
    const [identity] = await this.database.execute<IdentityRow[]>(
      'SELECT id, label, is_ai_disabled AS isAiDisabled FROM ai_users WHERE token_hash = ? AND revoked_at IS NULL', [tokenHash],
    )
    if (!identity) throw new UnauthorizedException('AI 凭证已失效，请重新激活。')
    return { id: identity.id, name: identity.label, tokenHash, isAiDisabled: Boolean(identity.isAiDisabled) }
  }

  async requireCurrent(connection: PoolConnection, id: string, tokenHash: Buffer): Promise<IdentityRow> {
    const identity = await this.requireActiveIdentity(connection, id)
    if (!identity.tokenHash.equals(tokenHash)) throw new UnauthorizedException('AI 凭证已失效。')
    return identity
  }

  private async resumeActivation(connection: PoolConnection, invite: InviteRow, token: Buffer) {
    if (!invite.userId || !invite.redeemedToken?.equals(token)) {
      throw new ConflictException('邀请码已使用。')
    }
    const identity = await this.requireCurrent(connection, invite.userId, token)
    return { id: identity.id, name: identity.label }
  }

  private async requireIdentity(connection: PoolConnection, id: string): Promise<IdentityRow> {
    const [[identity]] = await connection.execute<IdentityRow[]>(`SELECT id, label,
      token_hash AS tokenHash, revoked_at AS revokedAt, is_ai_disabled AS isAiDisabled
      FROM ai_users WHERE id = ? FOR UPDATE`, [id])
    if (!identity) throw new NotFoundException('桌面身份不存在。')
    return identity
  }

  private async requireActiveIdentity(connection: PoolConnection, id: string): Promise<IdentityRow> {
    const identity = await this.requireIdentity(connection, id)
    if (identity.revokedAt) throw new UnauthorizedException('该 AI 身份已撤销。')
    return identity
  }

  private limitActivation(): void {
    const now = Date.now()
    if (now >= this.activationWindow) {
      this.activationWindow = now + 60_000
      this.activationCount = 0
    }
    if (++this.activationCount > 60) throw new HttpException('激活请求过多，请稍后重试。', 429)
  }
}
