from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="POMOTODO_", extra="ignore"
    )

    database_url: str = (
        "postgresql+psycopg://pomotodo:pomotodo@localhost:5432/pomotodo"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
