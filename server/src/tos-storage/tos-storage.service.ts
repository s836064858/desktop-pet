import { Injectable } from '@nestjs/common'
import { storeGeneratedPng } from './tos-object-store'
import { TosSettingsService } from './tos-settings.service'

@Injectable()
export class TosStorageService {
  constructor(private readonly settings: TosSettingsService) {}

  async uploadGeneratedImage(options: { assetId: string; bytes: Uint8Array }) {
    const target = await this.settings.requireTarget()
    return storeGeneratedPng({ ...options, target })
  }
}
