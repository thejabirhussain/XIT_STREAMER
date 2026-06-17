import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StreamsService } from './streams.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';

@Controller('streams')
@UseGuards(JwtAuthGuard)
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

  /**
   * GET /api/streams
   */
  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.streamsService.listStreams(user.sub, status);
  }

  /**
   * POST /api/streams
   */
  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStreamDto,
  ) {
    return this.streamsService.createStream(user.sub, dto);
  }

  /**
   * GET /api/streams/:id
   */
  @Get(':id')
  async getOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.streamsService.getStream(user.sub, id);
  }

  /**
   * PATCH /api/streams/:id
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStreamDto,
  ) {
    return this.streamsService.updateStream(user.sub, id, dto);
  }

  /**
   * POST /api/streams/:id/start
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async start(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.streamsService.startStream(user.sub, id);
  }

  /**
   * POST /api/streams/:id/end
   */
  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  async end(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.streamsService.endStream(user.sub, id);
  }

  /**
   * POST /api/streams/:id/retry
   */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retry(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.streamsService.retryStream(user.sub, id);
  }

  /**
   * GET /api/streams/:id/health
   */
  @Get(':id/health')
  async health(@Param('id', ParseUUIDPipe) id: string) {
    return this.streamsService.getHealth(id);
  }

  /**
   * GET /api/streams/:id/chat
   */
  @Get(':id/chat')
  async chat(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('platform') platform?: string,
  ) {
    return this.streamsService.getChatHistory(id, page || 1, limit || 50, platform);
  }
}
