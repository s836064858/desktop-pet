import { BadRequestException, Injectable } from '@nestjs/common'
import type { RowDataPacket } from 'mysql2/promise'
import { DatabaseService } from '../database/database.service'
import { uuid } from './ai-input'
import { generatedImagesSql, modelPricing, usageCostParams, usageCostSql } from './ai-pricing'

@Injectable()
export class AiUsageService {
  constructor(private readonly database: DatabaseService) {}

  async report(options: { days?: string; result?: string; type?: string; userId?: string }) {
    const days = Number(options.days ?? 7)
    const { result, type } = options
    if (![7, 14, 30].includes(days) || (result && !['running', 'success', 'failed', 'unknown'].includes(result)) ||
      (type && !['chat', 'image'].includes(type))) throw new BadRequestException('用量筛选无效。')
    const userId = options.userId ? uuid(options.userId) : null
    const values = [days - 1]
    const where = `started_at >= UTC_DATE() - INTERVAL ? DAY
      ${result ? 'AND result = ?' : ''} ${type ? 'AND type = ?' : ''} ${userId ? 'AND user_id = ?' : ''}`
    const args = [...usageCostParams, ...values, ...(result ? [result] : []), ...(type ? [type] : []),
      ...(userId ? [userId] : [])]
    const pricedCalls = `SELECT ai_usage.*, ${usageCostSql} AS cost,
      ${generatedImagesSql} AS images FROM ai_usage WHERE ${where}`
    const [trend, calls] = await Promise.all([
      this.database.execute<RowDataPacket[]>(`SELECT DATE_FORMAT(started_at, '%Y-%m-%d') AS day,
        COUNT(*) AS requests, CAST(COALESCE(SUM(images), 0) AS UNSIGNED) AS images,
        CAST(SUM(result = 'failed') AS UNSIGNED) AS failures, CAST(SUM(result = 'unknown') AS UNSIGNED) AS unknowns,
        CAST(SUM(IF(type = 'chat', input_tokens, NULL)) AS UNSIGNED) AS inputTokens,
        CAST(SUM(IF(type = 'chat', output_tokens, NULL)) AS UNSIGNED) AS outputTokens,
        CAST(SUM(cached_input_tokens) AS UNSIGNED) AS cachedInputTokens, SUM(cost) AS cost,
        CAST(SUM(cost IS NULL AND result <> 'running') AS UNSIGNED) AS unpriced
        FROM (${pricedCalls}) AS priced GROUP BY day ORDER BY day`, args),
      this.database.execute<RowDataPacket[]>(`SELECT job_id AS id, label AS name, type, model, result,
        started_at AS startedAt, finished_at AS finishedAt, input_tokens AS inputTokens,
        output_tokens AS outputTokens, cached_input_tokens AS cachedInputTokens, images, cost,
        (SELECT status FROM ai_jobs WHERE id = priced.job_id) AS jobStatus
        FROM (${pricedCalls}) AS priced JOIN ai_users ON ai_users.id = priced.user_id
        ORDER BY started_at DESC, job_id DESC LIMIT 100`, args),
    ])
    return { trend, calls, pricing: modelPricing }
  }
}
