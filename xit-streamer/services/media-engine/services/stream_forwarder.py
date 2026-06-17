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
    """
    input_url = f"{settings.srs_rtmp_host}:{settings.srs_rtmp_port}/live/{stream_key}"

    cmd = ["ffmpeg", "-re", "-i", input_url]

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
            # WebRTC → transcode to H.264 + AAC
            cmd.extend([
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-tune", "zerolatency",
                "-b:v", "2500k",
                "-maxrate", "2500k",
                "-bufsize", "5000k",
                "-g", "60",
                "-c:a", "aac",
                "-b:a", "128k",
                "-ar", "44100",
                "-f", "flv",
                rtmp_url,
            ])
        else:
            # RTMP → codec copy (zero CPU)
            cmd.extend([
                "-c:v", "copy",
                "-c:a", "copy",
                "-f", "flv",
                rtmp_url,
            ])

    logger.info(f"Built FFmpeg command: {' '.join(cmd[:10])}... ({len(destinations)} destinations)")
    return cmd
