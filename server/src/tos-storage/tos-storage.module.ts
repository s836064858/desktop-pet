import { Module } from '@nestjs/common'
import { AdminAuthModule } from '../admin-auth/admin-auth.module'
import { DatabaseModule } from '../database/database.module'
import { TosSettingsController } from './tos-settings.controller'
import { TosSettingsService } from './tos-settings.service'
import { TosStorageService } from './tos-storage.service'

@Module({
  imports: [AdminAuthModule, DatabaseModule],
  controllers: [TosSettingsController],
  providers: [TosSettingsService, TosStorageService],
  exports: [TosStorageService, TosSettingsService],
})
export class TosStorageModule {}
