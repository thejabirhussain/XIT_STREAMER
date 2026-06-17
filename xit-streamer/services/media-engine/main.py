import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager
from routers import streams, health


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger("media-engine")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — startup and shutdown."""
    logger.info("🎬 XIT Streamer Media Engine starting...")
    yield
    # Shutdown: terminate all running FFmpeg processes
    from services.ffmpeg_manager import ffmpeg_manager
    await ffmpeg_manager.shutdown()
    logger.info("Media Engine shut down cleanly")


app = FastAPI(
    title="XIT Streamer Media Engine",
    description="FFmpeg orchestration service for multi-platform stream forwarding",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(streams.router, prefix="/streams", tags=["streams"])
app.include_router(health.router, tags=["health"])


if __name__ == "__main__":
    import uvicorn
    from config import settings

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.media_engine_port,
        reload=False,
    )
