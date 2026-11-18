import { Body, Controller, Get, Header, Headers, HttpCode, Param, Patch, Post, StreamableFile } from '@nestjs/common'
import { AiAccessService } from './ai-access.service'
import { AiAssetsService } from './ai-assets.service'
import { AiDraftsService } from './ai-drafts.service'
import { AiSettingsService } from './ai-settings.service'

@Controller('api/v1/ai')
export class AiDesktopController {
  constructor(
    private readonly access: AiAccessService,
    private readonly settings: AiSettingsService,
    private readonly drafts: AiDraftsService,
    private readonly assets: AiAssetsService,
  ) {}

  @Post('activate')
  @HttpCode(200)
  activate(@Body() body: unknown) {
    return this.access.activate(body)
  }

  @Get('status')
  async status(@Headers('authorization') auth?: string) {
    const identity = await this.access.authenticate(auth)
    const { isPaused } = await this.settings.summary()
    return { name: identity.name, isPaused, isAiDisabled: identity.isAiDisabled }
  }

  @Get('draft')
  async draft(@Headers('authorization') auth?: string) {
    return this.drafts.snapshot(await this.access.authenticate(auth))
  }

  @Get('draft/reference')
  async reference(@Headers('authorization') auth?: string) {
    return this.drafts.reference(await this.access.authenticate(auth))
  }

  @Patch('draft')
  @HttpCode(204)
  async update(@Body() body: unknown, @Headers('authorization') auth?: string) {
    await this.drafts.update(await this.access.authenticate(auth), body)
  }

  @Post('jobs')
  @HttpCode(202)
  async submit(@Body() body: unknown, @Headers('authorization') auth?: string) {
    return this.drafts.submit(await this.access.authenticate(auth), body)
  }

  @Get('assets/:id')
  @Header('X-Content-Type-Options', 'nosniff')
  async asset(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const identity = await this.access.authenticate(auth)
    const bytes = await this.assets.read(identity.id, id)
    return new StreamableFile(bytes, { type: 'image/png', length: bytes.length })
  }
}
