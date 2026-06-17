import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * YouTube Live Streaming API client.
 *
 * Creates YouTube liveBroadcast and liveStream objects, binds them together,
 * and returns the RTMP ingestion URL + stream key for FFmpeg forwarding.
 *
 * Docs: https://developers.google.com/youtube/v3/live/docs
 */
@Injectable()
export class YouTubeApiService {
  private readonly logger = new Logger(YouTubeApiService.name);

  /**
   * Create a YouTube live broadcast and bind it to a stream.
   * Returns the RTMP ingestion URL and stream name (key).
   */
  async createLiveStream(
    accessToken: string,
    title: string,
    description?: string,
  ): Promise<{ broadcastId: string; streamId: string; rtmpUrl: string; streamKey: string } | null> {
    try {
      // Step 1: Create the liveBroadcast
      const broadcastRes = await axios.post(
        'https://www.googleapis.com/youtube/v3/liveBroadcasts',
        {
          snippet: {
            title: title.slice(0, 100), // YouTube title limit
            scheduledStartTime: new Date().toISOString(),
            description: description || '',
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
          contentDetails: {
            enableDvr: true,
            enableContentEncryption: false,
            enableEmbed: true,
            recordFromStart: true,
            startWithSlate: false,
            monitorStream: {
              enableMonitorStream: false,
            },
          },
        },
        {
          params: { part: 'snippet,status,contentDetails' },
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        },
      );

      const broadcastId: string = broadcastRes.data.id;
      this.logger.log(`YouTube liveBroadcast created: ${broadcastId}`);

      // Step 2: Create the liveStream (ingestion configuration)
      const streamRes = await axios.post(
        'https://www.googleapis.com/youtube/v3/liveStreams',
        {
          snippet: { title: `XIT Stream - ${title.slice(0, 80)}` },
          cdn: {
            frameRate: 'variable',
            ingestionType: 'rtmp',
            resolution: 'variable',
          },
        },
        {
          params: { part: 'snippet,cdn,status' },
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        },
      );

      const streamId: string = streamRes.data.id;
      const ingestionInfo = streamRes.data.cdn?.ingestionInfo;
      const rtmpUrl: string = ingestionInfo?.ingestionAddress || 'rtmp://a.rtmp.youtube.com/live2';
      const streamKey: string = ingestionInfo?.streamName || '';

      this.logger.log(`YouTube liveStream created: ${streamId}, key: ${streamKey.slice(0, 8)}...`);

      // Step 3: Bind the broadcast to the stream
      await axios.post(
        'https://www.googleapis.com/youtube/v3/liveBroadcasts/bind',
        null,
        {
          params: {
            id: broadcastId,
            part: 'id,contentDetails',
            streamId,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        },
      );

      this.logger.log(`YouTube broadcast ${broadcastId} bound to stream ${streamId}`);

      return { broadcastId, streamId, rtmpUrl, streamKey };
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? JSON.stringify(error.response?.data || error.message)
        : (error instanceof Error ? error.message : 'Unknown error');
      this.logger.error(`YouTube live stream creation failed: ${msg}`);
      return null;
    }
  }

  /**
   * Transition a broadcast to "live" status (starts the actual livestream).
   */
  async transitionBroadcast(
    accessToken: string,
    broadcastId: string,
    status: 'testing' | 'live' | 'complete',
  ): Promise<boolean> {
    try {
      await axios.post(
        'https://www.googleapis.com/youtube/v3/liveBroadcasts/transition',
        null,
        {
          params: { broadcastStatus: status, id: broadcastId, part: 'id,status' },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        },
      );
      this.logger.log(`YouTube broadcast ${broadcastId} transitioned to: ${status}`);
      return true;
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? JSON.stringify(error.response?.data || error.message)
        : (error instanceof Error ? error.message : 'Unknown error');
      this.logger.warn(`YouTube broadcast transition failed (may be OK if stream not yet ready): ${msg}`);
      return false;
    }
  }

  /**
   * Complete (end) a YouTube live broadcast.
   */
  async completeBroadcast(accessToken: string, broadcastId: string): Promise<boolean> {
    return this.transitionBroadcast(accessToken, broadcastId, 'complete');
  }

  /**
   * Refresh an expired YouTube access token using the refresh token.
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; expiresIn: number } | null> {
    try {
      const res = await axios.post('https://oauth2.googleapis.com/token', null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        },
        timeout: 10000,
      });
      return {
        accessToken: res.data.access_token,
        expiresIn: res.data.expires_in || 3600,
      };
    } catch (error) {
      this.logger.error(`YouTube token refresh failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }
}
