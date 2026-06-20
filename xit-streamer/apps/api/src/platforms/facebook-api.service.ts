import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Facebook Graph API client for Live Video creation.
 *
 * Creates Facebook Live Video objects on a Facebook Page,
 * returns the RTMPS stream URL for FFmpeg forwarding.
 *
 * Docs: https://developers.facebook.com/docs/live-video-api/
 */
@Injectable()
export class FacebookApiService {
  private readonly logger = new Logger(FacebookApiService.name);

  /**
   * Get the Facebook Pages associated with the user's access token.
   */
  async getPages(
    accessToken: string,
  ): Promise<Array<{ id: string; name: string; accessToken: string }>> {
    if (accessToken.startsWith('mock_fb_token')) {
      return [{ id: 'mock_page_id', name: 'Mock Page', accessToken: 'mock_fb_token_page' }];
    }
    try {
      const res = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
        params: { access_token: accessToken, fields: 'id,name,access_token' },
        timeout: 10000,
      });
      return (res.data.data || []).map((p: { id: string; name: string; access_token: string }) => ({
        id: p.id,
        name: p.name,
        accessToken: p.access_token,
      }));
    } catch (error) {
      const msg = axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : String(error);
      this.logger.error(`Failed to get Facebook pages: ${msg}`);
      return [];
    }
  }

  /**
   * Create a Facebook Live Video on a Page.
   * Returns the RTMPS stream URL and stream key.
   *
   * Note: If the user has no Pages, posts to their personal timeline (requires publish_video scope).
   */
  async createLiveVideo(
    pageId: string,
    pageAccessToken: string,
    title: string,
    description?: string,
  ): Promise<{ liveVideoId: string; streamUrl: string; streamKey: string } | null> {
    if (pageAccessToken.startsWith('mock_fb_token')) {
      this.logger.log(`[MOCK MODE] Facebook Live Video created: mock_live_video_id on page ${pageId}`);
      return {
        liveVideoId: 'mock_live_video_id',
        streamUrl: 'rtmp://localhost:1935/live/fb_mock_stream_key_123456',
        streamKey: 'fb_mock_stream_key_123456',
      };
    }
    try {
      const res = await axios.post(
        `https://graph.facebook.com/v19.0/${pageId}/live_videos`,
        {
          title: title.slice(0, 255),
          description: description || '',
          status: 'LIVE_NOW',
        },
        {
          params: { access_token: pageAccessToken },
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        },
      );

      const { id: liveVideoId, stream_url } = res.data;

      if (!stream_url) {
        this.logger.error(`Facebook live_videos API returned no stream_url. Response: ${JSON.stringify(res.data)}`);
        return null;
      }

      // Facebook stream_url format: rtmps://live-api-s.facebook.com:443/rtmp/<STREAM_KEY>
      // Extract the stream key from the URL
      const urlParts = stream_url.split('/rtmp/');
      const streamKey = urlParts.length > 1 ? urlParts[1] : stream_url;
      const streamUrl = stream_url;

      this.logger.log(`Facebook Live Video created: ${liveVideoId} on page ${pageId}`);
      return { liveVideoId, streamUrl, streamKey };
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? JSON.stringify(error.response?.data || error.message)
        : (error instanceof Error ? error.message : 'Unknown error');
      this.logger.error(`Facebook live video creation failed: ${msg}`);
      return null;
    }
  }

  /**
   * End a Facebook Live Video.
   */
  async endLiveVideo(
    liveVideoId: string,
    accessToken: string,
  ): Promise<boolean> {
    if (accessToken.startsWith('mock_fb_token')) {
      this.logger.log(`[MOCK MODE] Facebook Live Video mock_live_video_id ended`);
      return true;
    }
    try {
      await axios.post(
        `https://graph.facebook.com/v19.0/${liveVideoId}`,
        { end_live_video: true },
        {
          params: { access_token: accessToken },
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        },
      );
      this.logger.log(`Facebook Live Video ${liveVideoId} ended`);
      return true;
    } catch (error) {
      const msg = axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : String(error);
      this.logger.warn(`Failed to end Facebook live video: ${msg}`);
      return false;
    }
  }

}
