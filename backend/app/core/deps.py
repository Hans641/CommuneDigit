"""
CommuneDigit — Dépendances d'authentification
Middleware FastAPI pour protéger les routes
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.core.security import decode_token
from app.models.models import Agent

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_agent(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Agent:
    """Vérifie le JWT et retourne l'agent connecté."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exc

    agent_id: int = payload.get("sub")
    if agent_id is None:
        raise credentials_exc

    agent = db.query(Agent).filter(Agent.id == int(agent_id), Agent.is_active == True).first()
    if agent is None:
        raise credentials_exc
    return agent


def require_role(*roles: str):
    """Vérifie que l'agent possède l'un des rôles requis."""
    def checker(current: Agent = Depends(get_current_agent)) -> Agent:
        if current.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès réservé aux rôles : {', '.join(roles)}",
            )
        return current
    return checker


def get_client_ip(request: Request) -> str:
    """Extrait l'adresse IP réelle du client."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"
