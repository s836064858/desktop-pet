import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { AdminOriginGuard, AdminSessionGuard } from './admin.guards'
import type { AdminRequest } from './admin.guards'
import { adminCookieOptions, ADMIN_SESSION_COOKIE } from './admin-session.cookie'
import { AdminSessionService } from './admin-session.service'
import type { AdminSession } from './admin-session.service'

@Controller('api/admin/session')
@UseGuards(AdminOriginGuard)
export class AdminSessionController {
  constructor(private readonly sessions: AdminSessionService) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminSession> {
    const { token, session } = await this.sessions.login(body)
    response.cookie(ADMIN_SESSION_COOKIE, token, {
      ...adminCookieOptions,
      expires: new Date(session.expiresAt),
    })
    return session
  }

  @Get()
  @UseGuards(AdminSessionGuard)
  @Header('Cache-Control', 'no-store')
  current(@Req() request: AdminRequest): AdminSession {
    return request.adminSession
  }

  @Delete()
  @UseGuards(AdminSessionGuard)
  @HttpCode(204)
  async logout(
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.revokeSession(request.adminSessionToken)
    response.clearCookie(ADMIN_SESSION_COOKIE, adminCookieOptions)
  }
}
