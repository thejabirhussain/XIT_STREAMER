from fastapi import APIRouter
from services.srs_client import srs_client
from services.ffmpeg_manager import ffmpeg_manager

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint for the media engine."""
    srs_healthy = await srs_client.is_healthy()
    active_sessions = len(ffmpeg_manager._processes)

    return {
        "status": "ok",
        "service": "media-engine",
        "srs_connected": srs_healthy,
        "active_ffmpeg_sessions": active_sessions,
    }
