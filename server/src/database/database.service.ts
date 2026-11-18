import { Injectable } from '@nestjs/common'
import type { OnApplicationShutdown } from '@nestjs/common'
import { createPool } from 'mysql2/promise'
import type { ExecuteValues, PoolConnection, QueryResult } from 'mysql2/promise'

const DATABASE_TIMEOUT_MS = 3000

function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`缺少环境变量 ${name}。`)
  return value
}

function readDatabasePort(): number {
  const port = Number(process.env.DB_PORT ?? 3306)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT 必须为有效端口。')
  }
  return port
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool = createPool({
    host: process.env.DB_HOST ?? 'localhost',
    port: readDatabasePort(),
    user: readRequiredEnv('DB_USER'),
    password: readRequiredEnv('DB_PASSWORD'),
    database: readRequiredEnv('DB_NAME'),
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    connectTimeout: DATABASE_TIMEOUT_MS,
    connectionLimit: 5,
    waitForConnections: false,
  })

  async checkConnection(): Promise<void> {
    await this.withConnection((connection) =>
      connection.query({ sql: 'SELECT 1', timeout: DATABASE_TIMEOUT_MS }),
    )
  }

  async execute<T extends QueryResult>(sql: string, values?: ExecuteValues): Promise<T> {
    const [rows] = await this.withConnection((connection) =>
      connection.execute<T>({ sql, timeout: DATABASE_TIMEOUT_MS }, values),
    )
    return rows
  }

  async withConnection<T>(action: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection()
    try {
      const result = await action(connection)
      connection.release()
      return result
    } catch (error) {
      connection.destroy()
      throw error
    }
  }

  async transaction<T>(action: (connection: PoolConnection) => Promise<T>): Promise<T> {
    return this.withConnection(async (connection) => {
      await connection.beginTransaction()
      const result = await action(connection)
      await connection.commit()
      return result
    })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}
