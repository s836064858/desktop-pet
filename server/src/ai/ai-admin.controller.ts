import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { AdminOriginGuard, AdminSessionGuard, AdminUserManagerGuard } from '../admin-auth/admin.guards'
import type { AdminRequest } from '../admin-auth/admin.guards'
import { DEFAULT_ADMIN_USERNAME } from '../admin-auth/admin-password'
import { AiAccessService } from './ai-access.service'
import { AiSettingsService } from './ai-settings.service'
import { AiUsageService } from './ai-usage.service'

@Controller('api/admin/ai')
@UseGuards(AdminOriginGuard, AdminSessionGuard)
export class AiAdminController {
  constructor(
    private readonly access: AiAccessService,
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
  ) {}

  @Get('invites')
  invites(@Req() request: AdminRequest) {
    return this.access.list(request.adminSession.username === DEFAULT_ADMIN_USERNAME)
  }

  @Post('invites')
  @UseGuards(AdminUserManagerGuard)
  issue(@Body() body: unknown) {
    return this.access.issue(body)
  }

  @Post('invites/batch')
  @UseGuards(AdminUserManagerGuard)
  issueBatch(@Body() body: unknown) {
    return this.access.issueBatch(body)
  }

  @Put('invites/:id/note')
  @UseGuards(AdminUserManagerGuard)
  @HttpCode(204)
  updateNote(@Param('id') id: string, @Body() body: unknown) {
    return this.access.updateNote(id, body)
  }

  @Post('invites/:id/revoke')
  @UseGuards(AdminUserManagerGuard)
  @HttpCode(204)
  revoke(@Param('id') id: string) {
    return this.access.revoke(id)
  }

  @Put('users/:id/status')
  @UseGuards(AdminUserManagerGuard)
  @HttpCode(204)
  setUserStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.access.setUserStatus(id, body)
  }

  @Get('config')
  config() {
    return this.settings.summary()
  }

  @Put('config/ark')
  @UseGuards(AdminUserManagerGuard)
  ark(@Body() body: unknown) {
    return this.settings.saveArk(body)
  }

  @Put('config/pause')
  @UseGuards(AdminUserManagerGuard)
  pause(@Body() body: unknown) {
    return this.settings.savePause(body)
  }

  @Get('usage')
  report(@Query('days') days?: string, @Query('result') result?: string, @Query('type') type?: string) {
    return this.usage.report({ days, result, type })
  }
}
