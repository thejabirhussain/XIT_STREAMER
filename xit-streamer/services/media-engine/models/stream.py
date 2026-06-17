from pydantic import BaseModel
from typing import Optional


class StreamDestination(BaseModel):
    """Destination platform for FFmpeg forwarding."""
    platform: str
    connection_id: str
    access_token: str
    rtmp_url: Optional[str] = None
    stream_key: Optional[str] = None


class StartStreamRequest(BaseModel):
    """Request to start FFmpeg forwarding for a stream."""
    stream_key: str
    ingest_type: str = "rtmp"  # "rtmp" or "webrtc"
    destinations: list[StreamDestination] = []


class HealthSnapshot(BaseModel):
    """Health metrics parsed from FFmpeg stderr."""
    bitrate_kbps: Optional[int] = None
    fps: Optional[float] = None
    dropped_frames: Optional[int] = None
    rtmp_connected: bool = True
    ffmpeg_running: bool = True
    uptime_seconds: int = 0
