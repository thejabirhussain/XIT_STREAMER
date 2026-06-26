import {
  Controller,
  Get,
  Post,
  Put,
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
import { ChatService } from '../chat/chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { WebRtcOfferDto } from './dto/webrtc-offer.dto';

@Controller('streams')
@UseGuards(JwtAuthGuard)
export class StreamsController {
  constructor(
    private readonly streamsService: StreamsService,
    private readonly chatService: ChatService,
  ) {}

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

  /**
   * PUT /api/streams/:id/instagram-credentials
   * Save the Instagram Live Producer RTMPS URL and stream key before going live.
   * The user copies these from instagram.com → Create → Live each session.
   */
  @Put(':id/instagram-credentials')
  @HttpCode(HttpStatus.OK)
  async saveInstagramCredentials(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('rtmpsUrl') rtmpsUrl: string,
    @Body('streamKey') streamKey: string,
  ) {
    return this.streamsService.saveInstagramCredentials(user.sub, id, rtmpsUrl, streamKey);
  }

  /**
   * POST /api/streams/:id/webrtc/offer
   * Browser Studio sends its SDP offer here.
   * The API proxies it to SRS /rtc/v1/publish/ and returns the SDP answer.
   * This enables browser-based WebRTC streaming without OBS Studio.
   */
  @Post(':id/webrtc/offer')
  @HttpCode(HttpStatus.OK)
  async webrtcOffer(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WebRtcOfferDto,
  ) {
    return this.streamsService.handleWebRtcOffer(user.sub, id, {
      sdp: dto.sdp,
      type: dto.type,
    });
  }

  /**
   * POST /api/streams/:id/chat/:messageId/moderate
   * Moderator actions: pin, unpin, highlight, unhighlight, feature, unfeature
   */
  @Post(':id/chat/:messageId/moderate')
  @HttpCode(HttpStatus.OK)
  async moderateMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body('action') action: 'pin' | 'unpin' | 'highlight' | 'unhighlight' | 'feature' | 'unfeature',
  ) {
    return this.chatService.moderateMessage(id, messageId, action);
  }

  /**
   * GET /api/streams/:id/chat/pinned
   */
  @Get(':id/chat/pinned')
  async getPinnedMessages(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatService.getPinnedMessages(id);
  }

  /**
   * GET /api/streams/:id/chat/featured
   */
  @Get(':id/chat/featured')
  async getFeaturedMessage(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatService.getFeaturedMessage(id);
  }

  /**
   * POST /api/streams/:id/chat/send
   * Streamer sends a message to selected platforms.
   */
  @Post(':id/chat/send')
  @HttpCode(HttpStatus.OK)
  async sendStreamerMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { message: string; platforms: string[] },
  ) {
    return this.streamsService.sendStreamerMessage(id, user.sub, body.message, body.platforms);
  }
}
