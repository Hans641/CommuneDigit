"""
CommuneDigit — Service Audit Log
Centralise toutes les écritures dans le journal d'audit
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import AuditLog
from app.core.security import sha256_hash


def log_action(
    db: Session,
    action: str,
    entite: str,
    detail: str,
    agent_id: Optional[int] = None,
    entite_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    niveau_risque: str = "Faible",
) -> AuditLog:
    """
    Enregistre une action dans le journal d'audit immuable.
    Le hash SHA-256 garantit l'intégrité de chaque entrée.
    """
    # Construire la chaîne à hasher
    raw = f"{action}|{entite}|{entite_id}|{detail}|{agent_id}|{datetime.utcnow().isoformat()}"
    entry_hash = sha256_hash(raw)

    log = AuditLog(
        action=action,
        entite=entite,
        entite_id=entite_id,
        detail=detail,
        agent_id=agent_id,
        ip_address=ip_address,
        niveau_risque=niveau_risque,
        hash_sha256=entry_hash,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
