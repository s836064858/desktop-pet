import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { AdminOriginGuard, AdminSessionGuard, AdminUserManagerGuard } from './admin.guards'
import { AdminUsersService } from './admin-users.service'

@Controller('api/admin/users')
@UseGuards(AdminOriginGuard, AdminSessionGuard, AdminUserManagerGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list() {
    return { users: await this.users.list() }
  }

  @Post()
  @HttpCode(204)
  create(@Body() body: { username?: unknown; password?: unknown } | null): Promise<void> {
    return this.users.create(body)
  }

  @Put(':id/status')
  @HttpCode(204)
  setEnabled(
    @Param('id', ParseIntPipe) id: number,
    @Body('isEnabled') isEnabled: unknown,
  ): Promise<void> {
    return this.users.setEnabled(id, isEnabled)
  }

  @Put(':id/password')
  @HttpCode(204)
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body('password') password: unknown,
  ): Promise<void> {
    return this.users.resetPassword(id, password)
  }
}
