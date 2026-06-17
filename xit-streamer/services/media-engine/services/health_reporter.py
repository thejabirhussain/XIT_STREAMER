import asyncio
import logging
import re
import subprocess
import time
from typing import Optional
import httpx
from config import settings

logger = logging.getLogger("health-reporter")


class HealthReporter:
    """
    Parses FFmpeg stderr output to extract stream health metrics
    and reports them to the API every 10 seconds.
    """

    def __init__(self, session_id: str, process: subprocess.Popen, start_time: float):
        self.session_id = session_id
        self.process = process
        self.start_time = start_time
        self._running = False

        # Latest metrics
        self.bitrate_kbps: Optional[int] = None
        self.fps: Optional[float] = None
        self.dropped_frames: int = 0

    async def start(self) -> None:
        """Start parsing stderr and reporting health."""
        self._running = True

        # Start stderr parser in background
        asyncio.create_task(self._parse_stderr())

        # Report health periodically
        while self._running and self.process.poll() is None:
            await self._report_health()
            await asyncio.sleep(settings.health_report_interval)

    def stop(self) -> None:
        """Stop the health reporter."""
        self._running = False

    async def _parse_stderr(self) -> None:
        """Parse FFmpeg stderr line-by-line for metrics."""
        if not self.process.stderr:
            return

        loop = asyncio.get_event_loop()

        while self._running and self.process.poll() is None:
            try:
                line = await loop.run_in_executor(
                    None, self.process.stderr.readline
                )

                if not line:
                    break

                decoded = line.decode("utf-8", errors="ignore").strip()

                # Parse bitrate: "bitrate=4500.2kbits/s" or "bitrate= 4500kbits/s"
                bitrate_match = re.search(r"bitrate=\s*([\d.]+)kbits/s", decoded)
                if bitrate_match:
                    self.bitrate_kbps = int(float(bitrate_match.group(1)))

                # Parse fps: "fps= 30" or "fps=29.97"
                fps_match = re.search(r"fps=\s*([\d.]+)", decoded)
                if fps_match:
                    self.fps = float(fps_match.group(1))

                # Parse dropped frames: "drop= 5" or "dup= 3"
                drop_match = re.search(r"drop=\s*(\d+)", decoded)
                if drop_match:
                    self.dropped_frames = int(drop_match.group(1))

            except Exception as e:
                if self._running:
                    logger.debug(f"Stderr parse error: {e}")
                break

    async def _report_health(self) -> None:
        """Report health snapshot to the API."""
        uptime = int(time.time() - self.start_time)

        payload = {
            "bitrate_kbps": self.bitrate_kbps,
            "fps": self.fps,
            "dropped_frames": self.dropped_frames,
            "rtmp_connected": self.process.poll() is None,
            "ffmpeg_running": self.process.poll() is None,
            "uptime_seconds": uptime,
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{settings.api_url}/api/internal/streams/{self.session_id}/health",
                    json=payload,
                    headers={"X-Internal-Secret": settings.media_engine_secret},
                )
        except Exception as e:
            logger.debug(f"Health report failed for {self.session_id}: {e}")
