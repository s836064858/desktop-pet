import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { NextFunction, Request, Response } from 'express'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const portValue = process.env.SERVER_PORT ?? '3000'
  const port = Number(portValue)
  if (!/^\d+$/.test(portValue) || port < 1 || port > 65535) {
    Logger.error('SERVER_PORT 必须为有效端口。', 'Bootstrap')
    process.exitCode = 1
    return
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { abortOnError: false })
  app.use('/api', (_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.useBodyParser('json', { limit: '9mb' })
  app.enableShutdownHooks()
  try {
    await app.listen(port, '127.0.0.1')
  } catch (error) {
    await app.close()
    throw error
  }
}

void bootstrap().catch(() => {
  Logger.error('服务启动失败，请检查本地配置和监听端口。', 'Bootstrap')
  process.exitCode = 1
})
