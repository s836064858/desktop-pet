import { Module } from '@nestjs/common'
import { AdminAuthModule } from './admin-auth/admin-auth.module'
import { DatabaseModule } from './database/database.module'
import { HealthController } from './health.controller'
import { TosStorageModule } from './tos-storage/tos-storage.module'
import { AiModule } from './ai/ai.module'

@Module({
  imports: [DatabaseModule, AdminAuthModule, TosStorageModule, AiModule],
  controllers: [HealthController],
})
export class AppModule {}
