import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { DEFAULT_ADMIN_USERNAME } from './admin-password'
import { ADMIN_ORIGIN, readAdminSessionToken } from './admin-session.cookie'
import { AdminSessionService } from './admin-session.service'
import type { AdminSession } from './admin-session.service'

export interface AdminRequest extends Request {
  adminSession: AdminSession
  adminSessionToken: string
}

@Injectable()
export class AdminOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true
    if (request.headers.origin !== ADMIN_ORIGIN) throw new ForbiddenException('请求来源无效。')
    return true
  }
}

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly sessions: AdminSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>()
    const token = readAdminSessionToken(request)
    if (!token) throw new UnauthorizedException('请登录管理后台。')
    request.adminSession = await this.sessions.requireSession(token)
    request.adminSessionToken = token
    return true
  }
}

@Injectable()
export class AdminUserManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>()
    if (request.adminSession?.username !== DEFAULT_ADMIN_USERNAME) {
      throw new ForbiddenException('此操作仅限默认管理员。')
    }
    return true
  }
}
