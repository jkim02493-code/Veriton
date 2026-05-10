from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    port: int = 8000
    mock_mode: bool = False
    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,https://docs.google.com"
    semantic_scholar_api_key: str | None = None
    openalex_api_key: str | None = None
    crossref_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
