"""
CommuneDigit — Configuration centrale
Gère les variables d'environnement et la connexion DB
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


class Settings(BaseSettings):
    app_name: str = "CommuneDigit"
    app_version: str = "1.0.2"
    debug: bool = False  # Surcharger avec DEBUG=true en développement

    # Base de données — SQLite par défaut pour dev sans PostgreSQL
    database_url: str = "sqlite:///./communedigit.db"

    # JWT
    secret_key: str = "dev-secret-key-changez-en-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # SMS (Africa's Talking)
    at_api_key: str = ""
    at_username: str = "sandbox"
    at_sender_id: str = "CommuneDigit"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# ── SQLAlchemy setup ─────────────────────────────────────────────
settings = get_settings()

# Adapter connect_args pour SQLite
connect_args = {"check_same_thread": False} if "sqlite" in settings.database_url else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency injection pour les sessions DB."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
