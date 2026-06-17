import logging
import httpx
from config import settings

logger = logging.getLogger("srs-client")


class SRSClient:
    """HTTP client for SRS media server API."""

    def __init__(self):
        self.base_url = settings.srs_http_api

    async def get_streams(self) -> list[dict]:
        """Get list of active streams from SRS."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/v1/streams/")
                data = response.json()
                return data.get("streams", [])
        except Exception as e:
            logger.error(f"Failed to get SRS streams: {e}")
            return []

    async def get_stream_info(self, stream_id: int) -> dict | None:
        """Get info about a specific SRS stream."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/v1/streams/{stream_id}")
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get SRS stream info: {e}")
            return None

    async def is_healthy(self) -> bool:
        """Check if SRS is reachable."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(f"{self.base_url}/api/v1/versions")
                return response.status_code == 200
        except Exception:
            return False


srs_client = SRSClient()
