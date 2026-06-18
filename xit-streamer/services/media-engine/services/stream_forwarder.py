import asyncio
import logging
from typing import Optional
from config import settings

logger = logging.getLogger("stream-forwarder")


def build_ffmpeg_command(
    stream_key: str,
    ingest_type: str,
    destinations: list[dict],
) -> list[str]:
    """
    Build FFmpeg command for multi-platform forwarding.

    For RTMP ingest (OBS): codec copy (no transcoding)
    For WebRTC ingest (browser): transcode to H.264+AAC

    Process-level retries are handled by FFmpegManager. The generic FFmpeg
    reconnect options are HTTP-specific and are not reliable for RTMP input.
    """
    input_url = f"{settings.srs_rtmp_host}:{settings.srs_rtmp_port}/live/{stream_key}"

    cmd = [
        "ffmpeg",
        # Read input in real-time (prevents frame buffering drift)
        "-re",
        "-i", input_url,
    ]

    for dest in destinations:
        platform = dest.get("platform", "")
        rtmp_url = dest.get("rtmp_url", "")
        dest_stream_key = dest.get("stream_key", "")

        if not rtmp_url:
            # Default RTMP/RTMPS URLs per platform
            if platform == "youtube":
                rtmp_url = f"rtmp://a.rtmp.youtube.com/live2/{dest_stream_key}"
            elif platform == "facebook":
                rtmp_url = f"rtmps://live-api-s.facebook.com:443/rtmp/{dest_stream_key}"
            elif platform == "instagram":
                rtmp_url = f"rtmps://live-upload.instagram.com:443/rtmp/{dest_stream_key}"
            else:
                logger.warning(f"Unknown platform: {platform}, skipping")
                continue

        if ingest_type == "webrtc":
            # WebRTC → transcode to H.264 + AAC (browser sends VP8/Opus via WebRTC)
            cmd.extend([
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-tune", "zerolatency",
                "-b:v", "2500k",
                "-maxrate", "2500k",
                "-bufsize", "5000k",
                # Keyframe every 2 seconds (required by YouTube/Facebook)
                "-g", "60",
                "-keyint_min", "60",
                "-c:a", "aac",
                "-b:a", "128k",
                "-ar", "44100",
                "-f", "flv",
                rtmp_url,
            ])
        else:
            # RTMP → codec copy (zero CPU — OBS already encodes)
            cmd.extend([
                "-c:v", "copy",
                "-c:a", "copy",
                "-f", "flv",
                rtmp_url,
            ])

    logger.info(f"Built FFmpeg command: {' '.join(cmd[:15])}... ({len(destinations)} destinations)")
    return cmd


async def wait_for_srs_stream(stream_key: str, max_wait_seconds: int = 15) -> bool:
    """
    For WebRTC streams, poll SRS until the stream is available before starting FFmpeg.
    This prevents FFmpeg from failing immediately when the browser hasn't published yet.
    """
    import httpx
    srs_api = settings.srs_http_api
    url = f"{srs_api}/api/v1/streams/"

    for attempt in range(max_wait_seconds):
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    streams = data.get("streams", [])
                    for stream in streams:
                        if stream.get("name") == stream_key:
                            logger.info(f"SRS stream '{stream_key}' is ready (after {attempt}s)")
                            return True
        except Exception as e:
            logger.debug(f"SRS stream check failed (attempt {attempt}): {e}")

        await asyncio.sleep(1)

    logger.warning(f"SRS stream '{stream_key}' not found after {max_wait_seconds}s — starting FFmpeg anyway")
    return False
