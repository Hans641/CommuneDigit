"""
CommuneDigit — Configuration centrale
Gère les variables d'environnement et la connexion DB
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import Literal

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


class Settings(BaseSettings):
    app_env: Literal["development", "test", "production"] = "development"
    payment_demo_enabled: bool = False
    seed_demo_accounts: bool = True

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
    # Inclure ici les origines de développement courantes (5173, 3000, 8082)
    allowed_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8082"

    # SMS (Africa's Talking)
    at_api_key: str = ""
    at_username: str = "sandbox"
    at_sender_id: str = "CommuneDigit"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    @model_validator(mode="after")
    def validate_production(self):
        if self.app_env == "production":
            if len(self.secret_key) < 32 or self.secret_key == "dev-secret-key-changez-en-prod":
                raise ValueError("Production : SECRET_KEY unique d'au moins 32 caractères requise")
            if self.debug or self.payment_demo_enabled or self.seed_demo_accounts:
                raise ValueError("Production : DEBUG, PAYMENT_DEMO_ENABLED et SEED_DEMO_ACCOUNTS doivent être false")
        return self

    class Config:
        hide_input_in_errors = True
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
