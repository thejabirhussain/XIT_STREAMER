import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class MediaClient {
  private readonly logger = new Logger(MediaClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('media.engineUrl', 'http://media-engine:8001');
    const secret = this.configService.get<string>('media.engineSecret', '');

    this.http = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
    });
  }

  /**
   * Tell the media engine to start FFmpeg forwarding for a stream.
   */
  async startStream(sessionId: string, data: {
    streamKey: string;
    ingestType: string;
    destinations: Array<{
      platform: string;
      connectionId: string;
      accessToken: string;
    }>;
  }): Promise<void> {
    try {
      await this.http.post(`/streams/${sessionId}/start`, data);
      this.logger.log(`Media engine: started stream ${sessionId}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Media engine start failed for ${sessionId}: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Tell the media engine to stop FFmpeg for a stream.
   */
  async endStream(sessionId: string): Promise<void> {
    try {
      await this.http.post(`/streams/${sessionId}/end`);
      this.logger.log(`Media engine: ended stream ${sessionId}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Media engine end failed for ${sessionId}: ${errMsg}`);
      throw error;
    }
  }
}
