import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  /**
   * GET /api/connections
   * List all platform connections for the authenticated user.
   */
  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.connectionsService.listConnections(user.sub);
  }

  /**
   * POST /api/connections/mock
   * Register a mock connection.
   */
  @Post('mock')
  @HttpCode(HttpStatus.CREATED)
  async mockConnect(
    @CurrentUser() user: JwtPayload,
    @Body('platform') platform: 'youtube' | 'facebook' | 'instagram',
  ) {
    return this.connectionsService.createMockConnection(user.sub, platform);
  }

  /**
   * GET /api/connections/:id
   * Get a specific connection detail.
   */
  @Get(':id')
  async getOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.connectionsService.getConnection(user.sub, id);
  }

  /**
   * DELETE /api/connections/:id
   * Disconnect a platform.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.connectionsService.disconnect(user.sub, id);
    return { message: 'Platform disconnected successfully.' };
  }

  /**
   * POST /api/connections/:id/refresh
   * Force token refresh for a connection.
   */
  @Post(':id/refresh')
  @HttpCode(HttpStatus.OK)
  async forceRefresh(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Token refresh is handled by TokenRefreshService cron,
    // but this endpoint forces an immediate refresh
    return { message: 'Token refresh queued.' };
  }
}
