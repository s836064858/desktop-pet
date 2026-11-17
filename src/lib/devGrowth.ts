import Database from '@tauri-apps/plugin-sql'

let previewDb: Promise<Database> | null = null

function getPreviewDatabase(): Promise<Database> {
  if (!import.meta.env.DEV) throw new Error('成长调试仅在开发环境可用。')
  if (!previewDb) {
    previewDb = Database.load('sqlite:sproutkin-dev.db')
      .then(async (db) => {
        await db.execute(
          'CREATE TABLE IF NOT EXISTS growth_preview (plant_id INTEGER PRIMARY KEY, days INTEGER NOT NULL)',
        )
        return db
      })
      .catch((error) => {
        previewDb = null
        throw error
      })
  }
  return previewDb
}

export async function readDevGrowthDays(plantId: number): Promise<number | null> {
  if (!import.meta.env.DEV) return null
  try {
    const db = await getPreviewDatabase()
    const rows = await db.select<Array<{ days: number }>>(
      'SELECT days FROM growth_preview WHERE plant_id = $1',
      [plantId],
    )
    const days = rows[0]?.days
    return Number.isInteger(days) && days >= 0 && days <= 36500 ? days : null
  } catch {
    return null
  }
}

export async function setDevGrowthDays(input: {
  plantId: number
  days: number | null
}): Promise<void> {
  if (!import.meta.env.DEV) throw new Error('成长调试仅在开发环境可用。')
  if (!Number.isSafeInteger(input.plantId) || input.plantId <= 0) throw new Error('请先领养植物。')
  if (
    input.days !== null &&
    (!Number.isInteger(input.days) || input.days < 0 || input.days > 36500)
  ) {
    throw new Error('预览天数需为 0–36500 的整数。')
  }
  const db = await getPreviewDatabase()
  if (input.days === null) {
    await db.execute('DELETE FROM growth_preview WHERE plant_id = $1', [input.plantId])
    return
  }
  await db.execute(
    'INSERT INTO growth_preview (plant_id, days) VALUES ($1, $2) ON CONFLICT(plant_id) DO UPDATE SET days = excluded.days',
    [input.plantId, input.days],
  )
}
