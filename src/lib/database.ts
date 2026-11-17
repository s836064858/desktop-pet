import { getDatabase as loadDb } from './databaseConnection'
import {
  BASE_SCHEMA,
  CARE_POINTS_TRIGGER,
  GROWTH_SCHEMA,
  POINTS_EARLY,
  POINTS_LATE,
  POINTS_ONTIME,
} from './growthSchema'
export { DAILY_POINTS_CAP, POINTS_EARLY, POINTS_LATE, POINTS_ONTIME } from './growthSchema'
import { saveInitialCareProfile } from './growthRepository'
import { validateCareProfile } from './careProfile'
import type { CareProfile } from './careProfile'

export type CareTaskType = 'water' | 'sun'
export type CareTaskStatus = 'pending' | 'reminded' | 'overdue' | 'done' | 'done_late'

export interface Plant {
  id: number
  species_code: string
  nickname: string
  adopted_at: number
  water_interval_h: number
  sun_interval_h: number
}

export interface CareTask {
  id: number
  plant_id: number
  type: CareTaskType
  scheduled_at: number
  status: CareTaskStatus
  snooze_count: number
  completed_at: number | null
}

export interface PointsSummary {
  balance: number
}

export interface CareResult {
  isEarly: boolean
  isLate: boolean
  points: number
  basePoints: number
}

export interface StreakInfo {
  currentCount: number
  longestCount: number
}

export interface PlantAdoptInput {
  speciesCode: string
  nickname: string
  careProfile: CareProfile
}

let schemaPromise: Promise<void> | null = null

export async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = initializeSchema().catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  await schemaPromise
}

async function initializeSchema(): Promise<void> {
  const db = await loadDb()
  for (const statement of [...BASE_SCHEMA, ...GROWTH_SCHEMA, CARE_POINTS_TRIGGER]) {
    await db.execute(statement)
  }
}

export async function getPlant(): Promise<Plant | null> {
  const db = await loadDb()
  const rows = await db.select<Plant[]>('SELECT * FROM plant ORDER BY id LIMIT 1')
  return rows[0] ?? null
}

export async function createPlant(input: PlantAdoptInput): Promise<Plant> {
  const profile = validateCareProfile(input.careProfile)
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(input.speciesCode) || !input.nickname.trim()) {
    throw new Error('请先选择植物并填写昵称。')
  }
  const db = await loadDb()
  const created = await db.execute(
    `INSERT INTO plant (species_code, nickname, adopted_at, water_interval_h, sun_interval_h)
      SELECT $1, $2, $3, $4, $5 WHERE NOT EXISTS (SELECT 1 FROM plant)`,
    [
      input.speciesCode,
      input.nickname.trim(),
      Date.now(),
      profile.waterEveryDays * 24,
      profile.lightEveryDays * 24,
    ],
  )
  if (!created.rowsAffected) throw new Error('已有领养中的植物，请重新加载。')
  const rows = await db.select<Plant[]>('SELECT * FROM plant ORDER BY id LIMIT 1')
  if (!rows[0]) throw new Error('领养创建失败')
  await db.execute('INSERT OR IGNORE INTO plant_growth (plant_id, started_at) VALUES ($1, $2)', [
    rows[0].id,
    Date.now(),
  ])
  await saveInitialCareProfile({ plantId: rows[0].id, profile })
  return rows[0]
}

export async function resetPlant(): Promise<void> {
  const db = await loadDb()
  await db.execute('DELETE FROM care_task')
  await db.execute('DELETE FROM plant')
}

export async function getOpenTask(plantId: number, type: CareTaskType): Promise<CareTask | null> {
  const db = await loadDb()
  const rows = await db.select<CareTask[]>(
    "SELECT * FROM care_task WHERE plant_id = $1 AND type = $2 AND status IN ('pending','reminded','overdue') ORDER BY scheduled_at DESC LIMIT 1",
    [plantId, type],
  )
  return rows[0] ?? null
}

export async function getLastCompletedAt(
  plantId: number,
  type: CareTaskType,
): Promise<number | null> {
  const db = await loadDb()
  const rows = await db.select<CareTask[]>(
    "SELECT * FROM care_task WHERE plant_id = $1 AND type = $2 AND status IN ('done','done_late') ORDER BY completed_at DESC LIMIT 1",
    [plantId, type],
  )
  return rows[0]?.completed_at ?? null
}

export async function createTask(
  plantId: number,
  type: CareTaskType,
  scheduledAt: number,
): Promise<void> {
  const db = await loadDb()
  await db.execute(
    `INSERT OR IGNORE INTO care_task (plant_id, type, scheduled_at)
      SELECT $1, $2, $3 WHERE $1 = (SELECT id FROM plant ORDER BY id LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM care_task WHERE plant_id = $1 AND type = $2
          AND status IN ('pending','reminded','overdue'))`,
    [plantId, type, scheduledAt],
  )
}

export async function markReminded(taskId: number): Promise<void> {
  const db = await loadDb()
  await db.execute(
    "UPDATE care_task SET status = 'reminded' WHERE id = $1 AND status = 'pending'",
    [taskId],
  )
}

export async function markOverdue(taskId: number): Promise<void> {
  const db = await loadDb()
  await db.execute(
    "UPDATE care_task SET status = 'overdue' WHERE id = $1 AND status = 'reminded'",
    [taskId],
  )
}

export async function getStreak(): Promise<StreakInfo> {
  const db = await loadDb()
  const rows = await db.select<Array<{ current_count: number; longest_count: number }>>(
    'SELECT current_count, longest_count FROM streak WHERE id = 1',
  )
  return { currentCount: rows[0]?.current_count ?? 0, longestCount: rows[0]?.longest_count ?? 0 }
}

async function readOpenCareTask(taskId: number): Promise<CareTask> {
  if (!Number.isSafeInteger(taskId) || taskId <= 0) throw new Error('任务标识不合法。')
  const db = await loadDb()
  const rows = await db.select<CareTask[]>('SELECT * FROM care_task WHERE id = $1', [taskId])
  const current = rows[0]
  if (!current || !['pending', 'reminded', 'overdue'].includes(current.status)) {
    throw new Error('任务状态已变化，请勿重复操作。')
  }
  return current
}

async function recordCareAction(input: { taskId: number; observationJson: string }): Promise<void> {
  const db = await loadDb()
  await db.execute(
    `INSERT INTO care_result (task_id, observation, created_at)
      SELECT $1, $2, $3 FROM care_task WHERE id = $1 AND status IN ('pending','reminded','overdue')
        AND plant_id = (SELECT id FROM plant ORDER BY id LIMIT 1)
      ON CONFLICT(task_id) DO UPDATE SET observation = excluded.observation, created_at = excluded.created_at`,
    [input.taskId, input.observationJson, Date.now()],
  )
}

async function applyCareCompletion(input: {
  task: CareTask
  observationJson: string
}): Promise<void> {
  const db = await loadDb()
  const status = input.task.status === 'overdue' ? 'done_late' : 'done'
  const updated = await db.execute(
    `UPDATE care_task SET status = $1, completed_at = $2 WHERE id = $3 AND status = $4
      AND plant_id = (SELECT id FROM plant ORDER BY id LIMIT 1)
      AND EXISTS (SELECT 1 FROM care_result WHERE task_id = care_task.id AND observation = $5)`,
    [status, Date.now(), input.task.id, input.task.status, input.observationJson],
  )
  if (!updated.rowsAffected) throw new Error('任务状态已变化，请重新加载后再操作。')
}

export async function completeTask(input: { task: CareTask }): Promise<CareResult> {
  const current = await readOpenCareTask(input.task.id)
  const observationJson = JSON.stringify({ action: current.type })
  await recordCareAction({ taskId: current.id, observationJson })
  await applyCareCompletion({ task: current, observationJson })
  const db = await loadDb()
  const ledger = await db.select<Array<{ delta: number }>>(
    'SELECT delta FROM points_ledger WHERE ref_task_id = $1 ORDER BY id DESC LIMIT 1',
    [current.id],
  )
  const isEarly = current.status === 'pending'
  const isLate = current.status === 'overdue'
  const basePoints = isEarly ? POINTS_EARLY : isLate ? POINTS_LATE : POINTS_ONTIME
  return { isEarly, isLate, points: ledger[0]?.delta ?? 0, basePoints }
}

export async function getRecentCareFeedback(plantId: number): Promise<{
  taskId: number
  type: CareTaskType
} | null> {
  const db = await loadDb()
  const rows = await db.select<Array<{ id: number; type: CareTaskType; observation: string }>>(
    `SELECT t.id, t.type, r.observation FROM care_task t JOIN care_result r ON r.task_id = t.id
      WHERE t.plant_id = $1 AND t.status IN ('done','done_late') AND t.completed_at >= $2
      ORDER BY t.completed_at DESC LIMIT 1`,
    [plantId, Date.now() - 6000],
  )
  if (!rows[0]) return null
  return { taskId: rows[0].id, type: rows[0].type }
}

export async function snoozeTask(taskId: number): Promise<boolean> {
  const db = await loadDb()
  const rows = await db.select<CareTask[]>('SELECT * FROM care_task WHERE id = $1', [taskId])
  const task = rows[0]
  if (
    !task ||
    task.snooze_count >= 3 ||
    !['pending', 'reminded', 'overdue'].includes(task.status)
  ) {
    return false
  }
  const SNOOZE_MS = 2 * 60 * 60 * 1000
  const updated = await db.execute(
    `UPDATE care_task SET scheduled_at = $1, snooze_count = $2, status = 'pending'
      WHERE id = $3 AND status = $4 AND snooze_count = $5
        AND plant_id = (SELECT id FROM plant ORDER BY id LIMIT 1)`,
    [task.scheduled_at + SNOOZE_MS, task.snooze_count + 1, taskId, task.status, task.snooze_count],
  )
  return updated.rowsAffected === 1
}

export async function listOpenTasks(plantId: number): Promise<CareTask[]> {
  const db = await loadDb()
  return db.select<CareTask[]>(
    "SELECT * FROM care_task WHERE plant_id = $1 AND status IN ('pending','reminded','overdue') ORDER BY scheduled_at ASC",
    [plantId],
  )
}

export async function getPointsBalance(): Promise<number> {
  const db = await loadDb()
  const rows = await db.select<PointsSummary[]>(
    'SELECT COALESCE(SUM(delta), 0) AS balance FROM points_ledger',
  )
  return rows[0]?.balance ?? 0
}

export async function getTodayPointsSum(): Promise<number> {
  const db = await loadDb()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)
  const rows = await db.select<PointsSummary[]>(
    'SELECT COALESCE(SUM(delta), 0) AS balance FROM points_ledger WHERE created_at >= $1 AND created_at < $2',
    [startOfToday.getTime(), endOfToday.getTime()],
  )
  return rows[0]?.balance ?? 0
}
