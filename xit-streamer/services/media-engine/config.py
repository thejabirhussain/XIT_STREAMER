from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Media engine configuration loaded from environment variables."""

    # API connection
    api_url: str = "http://api:4000"
    media_engine_port: int = 8001
    media_engine_secret: str = ""

    # SRS
    srs_http_api: str = "http://srs:1985"
    srs_rtmp_host: str = "rtmp://srs"
    srs_rtmp_port: int = 1935

    # Health reporting interval (seconds)
    health_report_interval: int = 10

    # FFmpeg retry config
    ffmpeg_max_retries: int = 3
    ffmpeg_retry_backoff: list[int] = [5, 10, 20]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
