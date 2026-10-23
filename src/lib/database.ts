import Database from '@tauri-apps/plugin-sql'

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
  waterIntervalH: number
  sunIntervalH: number
}

export const POINTS_ONTIME = 10
export const POINTS_EARLY = 8
export const POINTS_LATE = 5
export const DAILY_POINTS_CAP = 20

export const FULL_FORM_THRESHOLD = 30

export function getStageFromCount(count: number): { index: number, name: string } {
  if (count >= FULL_FORM_THRESHOLD) {
    return { index: 1, name: '完全体' }
  }
  return { index: 0, name: '成熟期' }
}

let dbPromise: Promise<Database> | null = null

function loadDb(): Promise<Database> {
  if (dbPromise === null) {
    dbPromise = Database.load('sqlite:plant-pet.db')
  }
  return dbPromise
}

export async function ensureSchema(): Promise<void> {
  const db = await loadDb()
  await db.execute(`
    CREATE TABLE IF NOT EXISTS plant (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      species_code TEXT NOT NULL,
      nickname TEXT NOT NULL,
      adopted_at INTEGER NOT NULL,
      water_interval_h INTEGER NOT NULL,
      sun_interval_h INTEGER NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS care_task (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('water','sun')),
      scheduled_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','reminded','overdue','done','done_late')),
      snooze_count INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      UNIQUE(plant_id, type, scheduled_at)
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS points_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref_task_id INTEGER,
      created_at INTEGER NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS streak (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_count INTEGER NOT NULL DEFAULT 0,
      longest_count INTEGER NOT NULL DEFAULT 0,
      last_done_date TEXT
    )
  `)
}

export async function getPlant(): Promise<Plant | null> {
  const db = await loadDb()
  const rows = await db.select<Plant[]>('SELECT * FROM plant ORDER BY id LIMIT 1')
  return rows[0] ?? null
}

export async function createPlant(input: PlantAdoptInput): Promise<Plant> {
  const db = await loadDb()
  await db.execute(
    'INSERT INTO plant (species_code, nickname, adopted_at, water_interval_h, sun_interval_h) VALUES ($1, $2, $3, $4, $5)',
    [input.speciesCode, input.nickname, Date.now(), input.waterIntervalH, input.sunIntervalH],
  )
  const rows = await db.select<Plant[]>('SELECT * FROM plant ORDER BY id DESC LIMIT 1')
  if (!rows[0]) {
    throw new Error('领养创建失败')
  }
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
    'SELECT * FROM care_task WHERE plant_id = $1 AND type = $2 AND status IN (\'pending\',\'reminded\',\'overdue\') ORDER BY scheduled_at DESC LIMIT 1',
    [plantId, type],
  )
  return rows[0] ?? null
}

export async function getLastCompletedAt(plantId: number, type: CareTaskType): Promise<number | null> {
  const db = await loadDb()
  const rows = await db.select<CareTask[]>(
    'SELECT * FROM care_task WHERE plant_id = $1 AND type = $2 AND status IN (\'done\',\'done_late\') ORDER BY completed_at DESC LIMIT 1',
    [plantId, type],
  )
  return rows[0]?.completed_at ?? null
}

export async function createTask(plantId: number, type: CareTaskType, scheduledAt: number): Promise<void> {
  const db = await loadDb()
  await db.execute(
    'INSERT OR IGNORE INTO care_task (plant_id, type, scheduled_at) VALUES ($1, $2, $3)',
    [plantId, type, scheduledAt],
  )
}

export async function markReminded(taskId: number): Promise<void> {
  const db = await loadDb()
  await db.execute('UPDATE care_task SET status = \'reminded\' WHERE id = $1 AND status = \'pending\'', [taskId])
}

export async function markOverdue(taskId: number): Promise<void> {
  const db = await loadDb()
  await db.execute('UPDATE care_task SET status = \'overdue\' WHERE id = $1 AND status = \'reminded\'', [taskId])
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function bumpStreakOnCare(): Promise<number> {
  const db = await loadDb()
  const today = toLocalDateStr(new Date())
  const rows = await db.select<Array<{ current_count: number, longest_count: number, last_done_date: string | null }>>(
    'SELECT current_count, longest_count, last_done_date FROM streak WHERE id = 1',
  )
  const row = rows[0]
  if (row?.last_done_date === today) {
    return row.current_count
  }
  const yesterday = toLocalDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const nextCurrent = row?.last_done_date === yesterday ? row.current_count + 1 : 1
  const nextLongest = Math.max(row?.longest_count ?? 0, nextCurrent)
  await db.execute(
    `INSERT INTO streak (id, current_count, longest_count, last_done_date) VALUES (1, $1, $2, $3)
     ON CONFLICT(id) DO UPDATE SET current_count = $1, longest_count = $2, last_done_date = $3`,
    [nextCurrent, nextLongest, today],
  )
  return nextCurrent
}

export async function getStreak(): Promise<StreakInfo> {
  const db = await loadDb()
  const rows = await db.select<Array<{ current_count: number, longest_count: number }>>(
    'SELECT current_count, longest_count FROM streak WHERE id = 1',
  )
  return { currentCount: rows[0]?.current_count ?? 0, longestCount: rows[0]?.longest_count ?? 0 }
}

export async function getTotalCompletedCount(): Promise<number> {
  const db = await loadDb()
  const rows = await db.select<PointsSummary[]>(
    'SELECT COUNT(*) AS balance FROM care_task WHERE status IN (\'done\',\'done_late\')',
  )
  return rows[0]?.balance ?? 0
}

export async function completeTask(task: CareTask): Promise<CareResult> {
  const db = await loadDb()
  const isEarly = task.status === 'pending'
  const isLate = task.status === 'overdue'
  const basePoints = isEarly ? POINTS_EARLY : isLate ? POINTS_LATE : POINTS_ONTIME
  const todaySum = await getTodayPointsSum()
  const points = Math.max(0, Math.min(basePoints, DAILY_POINTS_CAP - todaySum))
  const status = isLate ? 'done_late' : 'done'
  const updated = await db.execute(
    'UPDATE care_task SET status = $1, completed_at = $2 WHERE id = $3 AND status IN (\'pending\',\'reminded\',\'overdue\')',
    [status, Date.now(), task.id],
  )
  if (updated.rowsAffected === 0) {
    throw new Error('任务状态已变化，请勿重复操作')
  }
  if (points > 0) {
    const reason = isEarly ? `提前·${task.type}` : isLate ? `补做·${task.type}` : `按时·${task.type}`
    await db.execute(
      'INSERT INTO points_ledger (delta, reason, ref_task_id, created_at) VALUES ($1, $2, $3, $4)',
      [points, reason, task.id, Date.now()],
    )
  }
  await bumpStreakOnCare()
  return { isEarly, isLate, points, basePoints }
}

export async function snoozeTask(taskId: number): Promise<boolean> {
  const db = await loadDb()
  const rows = await db.select<CareTask[]>('SELECT * FROM care_task WHERE id = $1', [taskId])
  const task = rows[0]
  if (!task || task.snooze_count >= 3) {
    return false
  }
  const SNOOZE_MS = 2 * 60 * 60 * 1000
  await db.execute(
    'UPDATE care_task SET scheduled_at = $1, snooze_count = $2, status = \'pending\' WHERE id = $3',
    [task.scheduled_at + SNOOZE_MS, task.snooze_count + 1, taskId],
  )
  return true
}

export async function listOpenTasks(plantId: number): Promise<CareTask[]> {
  const db = await loadDb()
  return db.select<CareTask[]>(
    'SELECT * FROM care_task WHERE plant_id = $1 AND status IN (\'pending\',\'reminded\',\'overdue\') ORDER BY scheduled_at ASC',
    [plantId],
  )
}

export async function getPointsBalance(): Promise<number> {
  const db = await loadDb()
  const rows = await db.select<PointsSummary[]>('SELECT COALESCE(SUM(delta), 0) AS balance FROM points_ledger')
  return rows[0]?.balance ?? 0
}

export async function getTodayPointsSum(): Promise<number> {
  const db = await loadDb()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const rows = await db.select<PointsSummary[]>(
    'SELECT COALESCE(SUM(delta), 0) AS balance FROM points_ledger WHERE created_at >= $1',
    [startOfToday.getTime()],
  )
  return rows[0]?.balance ?? 0
}
