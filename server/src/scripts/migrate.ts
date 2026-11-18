import { readDefaultAdminHash, seedDefaultAdmin } from '../admin-auth/default-admin'
import { DatabaseService } from '../database/database.service'
import { runMigrations } from '../database/migration-runner'

async function migrate(): Promise<void> {
  const hash = readDefaultAdminHash()
  const database = new DatabaseService()
  try {
    await runMigrations(database)
    if (!(await seedDefaultAdmin(database, hash))) {
      console.warn('未配置 ADMIN_PASSWORD_HASH，默认管理员暂不可登录。')
    }
    console.info('数据库表已就绪。')
  } finally {
    await database.onApplicationShutdown()
  }
}

void migrate().catch((error: unknown) => {
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string' && /^[A-Z_0-9]+$/.test(error.code) ? ` (${error.code})` : ''
  console.error(`数据库迁移失败${code}，请检查连接、迁移记录与 ADMIN_PASSWORD_HASH 配置。`)
  process.exitCode = 1
})
