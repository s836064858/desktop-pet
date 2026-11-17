import Database from '@tauri-apps/plugin-sql'

let dbPromise: Promise<Database> | null = null

export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:plant-pet.db').catch((error) => {
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}
