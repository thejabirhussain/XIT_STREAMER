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

  /**
   * Create an Instagram Live using the Instagram Graph API.
   *
   * REQUIREMENTS:
   * - The user must have an Instagram Business or Creator account
   * - The account must be linked to a Facebook Page
   * - The app must have: instagram_basic, instagram_content_publish scopes
   * - For live_video creation: requires instagram_manage_live_media scope (Advanced Access)
   *
   * CURRENT STATUS:
   * Instagram Live Video creation via the Graph API (/live_media endpoint) requires
   * the instagram_manage_live_media scope which is a restricted permission requiring
   * Meta App Review. In development mode, it is only available to accounts added
   * as developers/testers in the Meta Developer Portal.
   *
   * The Instagram RTMPS ingest endpoint is:
   *   rtmps://live-upload.instagram.com:443/rtmp/{stream_key}
   */
  async createInstagramLive(
    instagramAccountId: string,
    accessToken: string,
    title: string,
  ): Promise<{ liveVideoId: string; streamUrl: string; streamKey: string } | null> {
    try {
      // Instagram Live Media endpoint requires instagram_manage_live_media
      const res = await axios.post(
        `https://graph.facebook.com/v19.0/${instagramAccountId}/live_media`,
        {
          title: title.slice(0, 255),
          broadcast_type: 'LIVE',
        },
        {
          params: { access_token: accessToken },
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        },
      );

      const { id: liveVideoId, stream_url } = res.data;

      if (!stream_url) {
        this.logger.error(`Instagram live_media API returned no stream_url. Response: ${JSON.stringify(res.data)}`);
        return null;
      }

      const urlParts = stream_url.split('/rtmp/');
      const streamKey = urlParts.length > 1 ? urlParts[1] : stream_url;

      this.logger.log(`Instagram Live created: ${liveVideoId} for account ${instagramAccountId}`);
      return { liveVideoId, streamUrl: stream_url, streamKey };
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? JSON.stringify(error.response?.data || error.message)
        : (error instanceof Error ? error.message : 'Unknown error');
      this.logger.error(`Instagram live creation failed (requires instagram_manage_live_media scope): ${msg}`);
      return null;
    }
  }
}
