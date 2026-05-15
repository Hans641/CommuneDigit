"""
CommuneDigit — Sécurité
JWT tokens + hachage bcrypt des mots de passe
"""
import hashlib
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings

settings = get_settings()

# ── Password hashing (Argon2id) ──────────────────────────────────
_ph = PasswordHasher()


def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, plain)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


# ── JWT ──────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


# ── SHA-256 intégrité données ────────────────────────────────────
def sha256_hash(data: str) -> str:
    """
    Calcule l'empreinte SHA-256 d'une chaîne de données.
    Utilisé pour garantir l'intégrité des actes d'état civil.
    """
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def hash_record(record_dict: dict) -> str:
    """Hash un dictionnaire de données d'un acte civil."""
    canonical = "|".join(f"{k}:{v}" for k, v in sorted(record_dict.items()))
    return sha256_hash(canonical)
