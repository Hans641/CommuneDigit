"""
CommuneDigit — Router : Authentification
POST /api/auth/login  → JWT token
GET  /api/auth/me     → profil courant
POST /api/auth/refresh → renouveler token
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.core.deps import get_current_agent, get_client_ip
from app.core.security import create_access_token, verify_password
from app.models.models import Agent
from app.schemas.schemas import LoginRequest, TokenResponse
from app.services.audit_service import log_action

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post("/login", response_model=TokenResponse, summary="Connexion agent")
def login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Authentifie un agent avec son matricule et mot de passe.
    Retourne un JWT Bearer token valide 8h.
    """
    # Chercher par matricule ou email
    agent = (
        db.query(Agent)
        .filter(
            (Agent.matricule == body.username) | (Agent.email == body.username),
            Agent.is_active == True,
        )
        .first()
    )

    if not agent or not verify_password(body.password, agent.hashed_password):
        log_action(
            db, action="LOGIN_FAIL", entite="Session",
            detail=f"Tentative échouée pour : {body.username}",
            ip_address=get_client_ip(request), niveau_risque="Moyen",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
        )

    # Mettre à jour last_login
    agent.last_login = datetime.utcnow()
    db.commit()

    # Créer le token
    token = create_access_token({"sub": str(agent.id), "role": agent.role})

    # Audit
    log_action(
        db, action="LOGIN", entite="Session",
        detail=f"Connexion réussie — {agent.nom} {agent.prenom} ({agent.role})",
        agent_id=agent.id, ip_address=get_client_ip(request),
    )

    return TokenResponse(
        access_token=token,
        user={
            "id": agent.id,
            "matricule": agent.matricule,
            "nom": agent.nom,
            "prenom": agent.prenom,
            "role": agent.role,
            "fokontany": agent.fokontany,
            "avatar": f"{agent.nom[0]}{agent.prenom[0]}".upper(),
        },
    )


@router.get("/me", summary="Profil de l'agent connecté")
def me(current: Agent = Depends(get_current_agent)):
    return {
        "id": current.id,
        "matricule": current.matricule,
        "nom": current.nom,
        "prenom": current.prenom,
        "role": current.role,
        "fokontany": current.fokontany,
        "email": current.email,
        "telephone": current.telephone,
        "is_active": current.is_active,
        "avatar": f"{current.nom[0]}{current.prenom[0]}".upper(),
    }


@router.post("/logout", summary="Déconnexion (révocation côté client)")
def logout(current: Agent = Depends(get_current_agent), db: Session = Depends(get_db)):
    log_action(db, action="LOGOUT", entite="Session",
               detail=f"Déconnexion — {current.matricule}", agent_id=current.id)
    return {"message": "Déconnecté. Supprimer le token côté client."}
