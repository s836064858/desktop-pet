import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common'
import { DatabaseService } from './database/database.service'

@Controller('api')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('health')
  @Header('Cache-Control', 'no-store')
  async checkHealth(): Promise<{ status: 'ok'; database: 'ok' }> {
    try {
      await this.database.checkConnection()
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', database: 'unavailable' })
    }

    return { status: 'ok', database: 'ok' }
  }
}
