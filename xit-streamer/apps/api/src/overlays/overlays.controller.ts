import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { OverlaysService } from './overlays.service';
import { CreateOverlayDto } from './dto/create-overlay.dto';
import { UpdateOverlayDto } from './dto/update-overlay.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@Controller('streams/:sessionId/overlays')
@UseGuards(JwtAuthGuard)
export class OverlaysController {
  constructor(private readonly service: OverlaysService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.service.list(user.sub, sessionId);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateOverlayDto,
  ) {
    return this.service.create(user.sub, sessionId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOverlayDto,
  ) {
    return this.service.update(user.sub, sessionId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user.sub, sessionId, id);
  }

  @Post(':id/toggle')
  toggle(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.toggleVisibility(user.sub, sessionId, id);
  }

  @Post('reorder')
  reorder(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.service.reorderZIndex(user.sub, sessionId, body.orderedIds);
  }
}
