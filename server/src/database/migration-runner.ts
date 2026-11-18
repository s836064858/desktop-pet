import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import type { DatabaseService } from './database.service'

interface Migration {
  id: string
  checksum: string
  statements: string[]
}

interface AppliedMigration extends RowDataPacket {
  id: string
  checksum: string
}

const SQL_DIRECTORY = resolve(__dirname, '../../sql')
const STATEMENT_TIMEOUT_MS = 30000
const LOCK_NAME = "CONCAT('sproutkin:migrate:', LEFT(SHA2(DATABASE(), 256), 40))"

function splitStatements(source: string): string[] {
  return source
    .split(/;\s*(?:\r?\n|$)/u)
    .map((statement) => statement.trim())
    .filter(Boolean)
}

async function readMigrations(): Promise<Migration[]> {
  const directory = resolve(SQL_DIRECTORY, 'migrations')
  const filenames = (await readdir(directory))
    .filter((name) => /^\d{3}-[a-z-]+\.sql$/u.test(name))
    .sort()
  if (!filenames.length) throw new Error('没有找到数据库迁移文件。')
  const migrations: Migration[] = []
  for (const filename of filenames) {
    const source = await readFile(resolve(directory, filename), 'utf8')
    migrations.push({
      id: filename,
      checksum: createHash('sha256').update(source).digest('hex'),
      statements: splitStatements(source),
    })
  }
  return migrations
}

async function query(connection: PoolConnection, sql: string): Promise<void> {
  await connection.query({ sql, timeout: STATEMENT_TIMEOUT_MS })
}

function verifyHistory(migrations: Migration[], applied: AppliedMigration[]): void {
  const expected = new Map(migrations.map((migration) => [migration.id, migration.checksum]))
  for (const migration of applied) {
    if (!expected.has(migration.id)) throw new Error('数据库包含当前程序不支持的迁移版本。')
    if (expected.get(migration.id) !== migration.checksum) {
      throw new Error(`迁移 ${migration.id} 已执行后被修改，请恢复原文件。`)
    }
  }
}

async function applyMigrations(connection: PoolConnection, migrations: Migration[]): Promise<void> {
  const ledger = await readFile(resolve(SQL_DIRECTORY, '000-schema-migrations.sql'), 'utf8')
  for (const statement of splitStatements(ledger)) await query(connection, statement)
  const [applied] = await connection.query<AppliedMigration[]>(
    'SELECT id, checksum FROM schema_migrations ORDER BY id',
  )
  verifyHistory(migrations, applied)
  const appliedIds = new Set(applied.map((migration) => migration.id))
  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue
    for (const statement of migration.statements) await query(connection, statement)
    await connection.execute(
      'INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?, ?, UTC_TIMESTAMP(3))',
      [migration.id, migration.checksum],
    )
  }
}

async function migrateConnection(connection: PoolConnection, migrations: Migration[]): Promise<void> {
  const [rows] = await connection.query<Array<RowDataPacket & { isAcquired: number | null }>>({
    sql: `SELECT GET_LOCK(${LOCK_NAME}, 10) AS isAcquired`,
    timeout: 12000,
  })
  if (rows[0]?.isAcquired !== 1) throw new Error('其他迁移正在运行，请稍后重试。')
  try {
    await applyMigrations(connection, migrations)
  } finally {
    await query(connection, `DO RELEASE_LOCK(${LOCK_NAME})`)
  }
}

export async function runMigrations(database: DatabaseService): Promise<void> {
  const migrations = await readMigrations()
  await database.withConnection((connection) => migrateConnection(connection, migrations))
}
