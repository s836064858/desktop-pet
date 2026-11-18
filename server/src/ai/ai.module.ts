import { Module } from '@nestjs/common'
import { AdminAuthModule } from '../admin-auth/admin-auth.module'
import { DatabaseModule } from '../database/database.module'
import { AiAccessService } from './ai-access.service'
import { AiAdminController } from './ai-admin.controller'
import { AiAssetsService } from './ai-assets.service'
import { AiDesktopController } from './ai-desktop.controller'
import { AiDraftsService } from './ai-drafts.service'
import { AiSettingsService } from './ai-settings.service'
import { AiUsageService } from './ai-usage.service'
import { AiWorker } from './ai-worker'

@Module({
  imports: [DatabaseModule, AdminAuthModule],
  controllers: [AiAdminController, AiDesktopController],
  providers: [AiAccessService, AiAssetsService, AiDraftsService, AiSettingsService, AiUsageService, AiWorker],
})
export class AiModule {}
