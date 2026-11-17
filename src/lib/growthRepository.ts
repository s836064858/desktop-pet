import { getDatabase } from './databaseConnection'
import { BUILTIN_CARE_PROFILES, readCareProfile, validateCareProfile } from './careProfile'
import type { CareProfile } from './careProfile'
import { localDateKey } from './growth'

export interface DailyInteractionRecord {
  day_key: string
  is_complete: number
}

export interface GrowthSnapshot {
  days: number
  previewDays: number | null
  dayKey: string
  startedAt: number
  profile: CareProfile | null
  today: DailyInteractionRecord | null
}

interface GrowthRow {
  started_at: number
  species_code: string
  care_profile: string | null
  days: number
  day_key: string | null
  is_complete: number
}

export function emptyGrowthSnapshot(): GrowthSnapshot {
  return {
    days: 0,
    previewDays: null,
    dayKey: localDateKey(),
    startedAt: 0,
    profile: null,
    today: null,
  }
}

async function readPlantProfile(row: GrowthRow): Promise<CareProfile> {
  if (row.care_profile) return readCareProfile(JSON.parse(row.care_profile), row.species_code)
  if (Object.hasOwn(BUILTIN_CARE_PROFILES, row.species_code))
    return readCareProfile(null, row.species_code)
  const { getCustomSpecies } = await import('./spriteLibrary')
  const meta = await getCustomSpecies(row.species_code)
  return readCareProfile(meta?.careProfile, row.species_code)
}

export async function getGrowthSnapshot(plantId: number): Promise<GrowthSnapshot> {
  const db = await getDatabase()
  const dayKey = localDateKey()
  const rows = await db.select<GrowthRow[]>(
    `SELECT g.started_at, g.care_profile, p.species_code, t.day_key, t.is_complete,
      (SELECT COUNT(*) FROM daily_inspection WHERE plant_id = g.plant_id AND is_complete = 1) AS days
      FROM plant_growth g JOIN plant p ON p.id = g.plant_id
      LEFT JOIN daily_inspection t ON t.plant_id = g.plant_id AND t.day_key = $2
      WHERE g.plant_id = $1`,
    [plantId, dayKey],
  )
  const row = rows[0]
  if (!row) throw new Error('成长数据尚未初始化，请重新加载。')
  const profile = await readPlantProfile(row)
  const previewDays = import.meta.env.DEV
    ? await (await import('./devGrowth')).readDevGrowthDays(plantId)
    : null
  return {
    days: row.days,
    previewDays,
    dayKey,
    startedAt: row.started_at,
    profile,
    today: row.day_key ? { day_key: row.day_key, is_complete: row.is_complete } : null,
  }
}

export async function saveInitialCareProfile(input: {
  plantId: number
  profile: CareProfile
}): Promise<void> {
  const profile = validateCareProfile(input.profile)
  const db = await getDatabase()
  const result = await db.execute(
    `UPDATE plant_growth SET care_profile = $1, confirmed_at = $2
      WHERE plant_id = $3 AND confirmed_at IS NULL
      AND plant_id = (SELECT id FROM plant ORDER BY id LIMIT 1)`,
    [JSON.stringify(profile), Date.now(), input.plantId],
  )
  if (!result.rowsAffected) throw new Error('植物或习性状态已变化，请重新加载。')
}

export async function recordDailyInteraction(input: {
  plantId: number
}): Promise<{ hasGrown: boolean }> {
  if (!Number.isSafeInteger(input.plantId) || input.plantId <= 0) throw new Error('请先领养植物。')
  const now = Date.now()
  const dayKey = localDateKey(new Date(now))
  const db = await getDatabase()
  // 沿用历史表与唯一键；重复互动成功返回，不重复累计，也不虚构观察结果。
  const result = await db.execute(
    `INSERT INTO daily_inspection (plant_id, day_key, water, light, is_complete, created_at)
      SELECT $1, $2, 'unknown', 'unknown', 1, $3 FROM plant_growth
      WHERE plant_id = $1 AND plant_id = (SELECT id FROM plant ORDER BY id LIMIT 1)
      ON CONFLICT(plant_id, day_key) DO UPDATE SET is_complete = 1
      WHERE daily_inspection.is_complete = 0`,
    [input.plantId, dayKey, now],
  )
  if (result.rowsAffected) return { hasGrown: true }
  const rows = await db.select<Array<{ plant_id: number }>>(
    `SELECT d.plant_id FROM daily_inspection d JOIN plant p ON p.id = d.plant_id
      WHERE d.plant_id = $1 AND d.day_key = $2 AND d.is_complete = 1
      AND p.id = (SELECT id FROM plant ORDER BY id LIMIT 1)`,
    [input.plantId, dayKey],
  )
  if (!rows.length) throw new Error('植物状态已变化，请重新打开面板。')
  return { hasGrown: false }
}
