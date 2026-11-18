import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { AdminSessionController } from './admin-session.controller'
import { AdminOriginGuard, AdminSessionGuard, AdminUserManagerGuard } from './admin.guards'
import { AdminSessionService } from './admin-session.service'
import { AdminUsersController } from './admin-users.controller'
import { AdminUsersService } from './admin-users.service'

@Module({
  imports: [DatabaseModule],
  controllers: [AdminSessionController, AdminUsersController],
  providers: [
    AdminSessionService,
    AdminUsersService,
    AdminOriginGuard,
    AdminSessionGuard,
    AdminUserManagerGuard,
  ],
  exports: [AdminSessionService, AdminOriginGuard, AdminSessionGuard, AdminUserManagerGuard],
})
export class AdminAuthModule {}
