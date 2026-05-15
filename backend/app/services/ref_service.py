"""
CommuneDigit — Générateur de références et matricules
Format cohérent pour tous les documents
"""
import random
import string
from datetime import datetime
from sqlalchemy.orm import Session


def _rand(n=6) -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=n))


def gen_reference(prefix: str) -> str:
    """Ex: EC-20260503-A3K9PX"""
    date_str = datetime.utcnow().strftime("%Y%m%d")
    return f"{prefix}-{date_str}-{_rand(6)}"


def gen_matricule(db: Session) -> str:
    """Ex: AGT-0042"""
    from app.models.models import Agent
    count = db.query(Agent).count() + 1
    return f"AGT-{str(count).zfill(4)}"


def gen_idempotency_key() -> str:
    """Clé d'idempotence pour transactions ACID."""
    return f"IDEM-{''.join(random.choices(string.ascii_lowercase + string.digits, k=10))}"
