import asyncio
import logging
import signal
import subprocess
import time
from typing import Optional
from config import settings
from services.stream_forwarder import build_ffmpeg_command, wait_for_srs_stream
from services.health_reporter import HealthReporter

logger = logging.getLogger("ffmpeg-manager")


class FFmpegManager:
    """
    Manages FFmpeg subprocess lifecycle for each stream session.
    - One FFmpeg process per session
    - Automatic health monitoring via stderr parsing
    - Retry with exponential backoff on crash (3 attempts)
    - Graceful shutdown with SIGTERM → SIGKILL
    """

    def __init__(self):
        self._processes: dict[str, subprocess.Popen] = {}
        self._health_reporters: dict[str, HealthReporter] = {}
        self._retry_counts: dict[str, int] = {}
        self._start_times: dict[str, float] = {}

    async def start(
        self,
        session_id: str,
        stream_key: str,
        ingest_type: str,
        destinations: list[dict],
    ) -> bool:
        """Start FFmpeg forwarding for a session."""
        if session_id in self._processes:
            logger.warning(f"FFmpeg already running for session {session_id}")
            return True

        # For WebRTC streams: wait for SRS to report the stream as ready
        # so FFmpeg doesn't start before the browser has published
        if ingest_type == "webrtc":
            logger.info(f"WebRTC stream — waiting for SRS to receive stream '{stream_key}'…")
            await wait_for_srs_stream(stream_key, max_wait_seconds=15)

        cmd = build_ffmpeg_command(stream_key, ingest_type, destinations)

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,
            )

            self._processes[session_id] = process
            # Preserve the counter when start() is called by the crash-retry
            # path; resetting it here would allow infinite retries.
            self._retry_counts.setdefault(session_id, 0)
            self._start_times[session_id] = time.time()

            # Start health reporter (parses stderr in background)
            reporter = HealthReporter(session_id, process, self._start_times[session_id])
            self._health_reporters[session_id] = reporter
            asyncio.create_task(reporter.start())

            # Monitor process in background
            asyncio.create_task(
                self._monitor_process(session_id, stream_key, ingest_type, destinations)
            )

            logger.info(f"FFmpeg started for session {session_id} (PID: {process.pid})")
            return True

        except Exception as e:
            logger.error(f"Failed to start FFmpeg for {session_id}: {e}")
            return False

    async def stop(self, session_id: str) -> None:
        """Gracefully stop FFmpeg for a session."""
        process = self._processes.get(session_id)
        if not process:
            logger.warning(f"No FFmpeg process found for session {session_id}")
            return

        # Stop health reporter
        reporter = self._health_reporters.pop(session_id, None)
        if reporter:
            reporter.stop()

        # SIGTERM → wait 10s → SIGKILL
        try:
            process.send_signal(signal.SIGTERM)
            logger.info(f"Sent SIGTERM to FFmpeg (PID: {process.pid}) for session {session_id}")

            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                logger.warning(f"FFmpeg did not exit after SIGTERM, sending SIGKILL")
                process.kill()
                process.wait(timeout=5)

        except Exception as e:
            logger.error(f"Error stopping FFmpeg for {session_id}: {e}")
        finally:
            self._processes.pop(session_id, None)
            self._retry_counts.pop(session_id, None)
            self._start_times.pop(session_id, None)

        logger.info(f"FFmpeg stopped for session {session_id}")

    async def _monitor_process(
        self,
        session_id: str,
        stream_key: str,
        ingest_type: str,
        destinations: list[dict],
    ) -> None:
        """Monitor FFmpeg process and retry on crash."""
        process = self._processes.get(session_id)
        if not process:
            return

        # Wait for process to exit
        loop = asyncio.get_event_loop()
        return_code = await loop.run_in_executor(None, process.wait)

        if session_id not in self._processes:
            # Process was intentionally stopped
            return

        if return_code != 0:
            retry_count = self._retry_counts.get(session_id, 0)
            max_retries = settings.ffmpeg_max_retries

            if retry_count < max_retries:
                backoff = settings.ffmpeg_retry_backoff[min(retry_count, len(settings.ffmpeg_retry_backoff) - 1)]
                self._retry_counts[session_id] = retry_count + 1

                logger.warning(
                    f"FFmpeg crashed for {session_id} (exit code: {return_code}). "
                    f"Retry {retry_count + 1}/{max_retries} in {backoff}s"
                )

                # Clean up old process
                self._processes.pop(session_id, None)
                reporter = self._health_reporters.pop(session_id, None)
                if reporter:
                    reporter.stop()

                await asyncio.sleep(backoff)
                await self.start(session_id, stream_key, ingest_type, destinations)
            else:
                logger.error(
                    f"FFmpeg failed {max_retries} times for {session_id}. "
                    f"Reporting error to API."
                )
                self._processes.pop(session_id, None)
                self._health_reporters.pop(session_id, None)

                # Report error to API
                import httpx
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"{settings.api_url}/api/internal/streams/{session_id}/health",
                            json={
                                "ffmpeg_running": False,
                                "rtmp_connected": False,
                            },
                            headers={"X-Internal-Secret": settings.media_engine_secret},
                        )
                except Exception as e:
                    logger.error(f"Failed to report error to API: {e}")

    def is_running(self, session_id: str) -> bool:
        """Check if FFmpeg is running for a session."""
        process = self._processes.get(session_id)
        return process is not None and process.poll() is None

    async def shutdown(self) -> None:
        """Shutdown all running FFmpeg processes."""
        sessions = list(self._processes.keys())
        for session_id in sessions:
            await self.stop(session_id)
        logger.info(f"Shutdown complete — stopped {len(sessions)} FFmpeg process(es)")


# Singleton instance
ffmpeg_manager = FFmpegManager()
