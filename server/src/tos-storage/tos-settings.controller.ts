import { Body, Controller, Get, Header, Put, UseGuards } from '@nestjs/common'
import { AdminOriginGuard, AdminSessionGuard, AdminUserManagerGuard } from '../admin-auth/admin.guards'
import { TosSettingsService } from './tos-settings.service'

@Controller('api/admin/ai/config/storage')
@UseGuards(AdminOriginGuard, AdminSessionGuard)
export class TosSettingsController {
  constructor(private readonly settings: TosSettingsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async current() {
    return { settings: await this.settings.getSettings() }
  }

  @Put()
  @UseGuards(AdminUserManagerGuard)
  @Header('Cache-Control', 'no-store')
  async save(@Body() body: unknown) {
    return { settings: await this.settings.saveSettings(body) }
  }
}
