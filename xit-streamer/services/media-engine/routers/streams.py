import logging
from fastapi import APIRouter, HTTPException
from models.stream import StartStreamRequest
from services.ffmpeg_manager import ffmpeg_manager

logger = logging.getLogger("streams-router")

router = APIRouter()


@router.post("/{session_id}/start")
async def start_stream(session_id: str, request: StartStreamRequest):
    """
    Start FFmpeg forwarding for a stream session.
    Called by the NestJS API when a stream is started.
    """
    destinations = [
        {
            "platform": d.platform,
            "connection_id": d.connection_id,
            "access_token": d.access_token,
            "rtmp_url": d.rtmp_url,
            "stream_key": d.stream_key,
        }
        for d in request.destinations
    ]

    success = await ffmpeg_manager.start(
        session_id=session_id,
        stream_key=request.stream_key,
        ingest_type=request.ingest_type,
        destinations=destinations,
    )

    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start FFmpeg for session {session_id}",
        )

    return {
        "status": "started",
        "session_id": session_id,
        "ffmpeg_running": True,
    }


@router.post("/{session_id}/end")
async def end_stream(session_id: str):
    """
    Stop FFmpeg forwarding for a stream session.
    Called by the NestJS API when a stream is ended.
    """
    await ffmpeg_manager.stop(session_id)

    return {
        "status": "stopped",
        "session_id": session_id,
        "ffmpeg_running": False,
    }


@router.get("/{session_id}/status")
async def stream_status(session_id: str):
    """Check if FFmpeg is running for a session."""
    running = ffmpeg_manager.is_running(session_id)
    return {
        "session_id": session_id,
        "ffmpeg_running": running,
    }
