"""
CommuneDigit — Router : Citoyens
CRUD complet + recherche + pagination
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.core.deps import get_current_agent, get_client_ip
from app.models.models import Agent, Citoyen
from app.schemas.schemas import CitoyenCreate, CitoyenOut, CitoyenUpdate
from app.services.audit_service import log_action

router = APIRouter(prefix="/citoyens", tags=["Citoyens"])


@router.get("/", response_model=List[CitoyenOut], summary="Lister les citoyens")
def list_citoyens(
    q:           Optional[str] = Query(None, description="Recherche nom/prénom/CIN"),
    fokontany_id:Optional[int] = Query(None),
    is_active:   Optional[bool] = Query(True),
    skip:        int = Query(0, ge=0),
    limit:       int = Query(50, ge=1, le=200),
    db:          Session = Depends(get_db),
    _:           Agent = Depends(get_current_agent),
):
    query = db.query(Citoyen)
    if is_active is not None:
        query = query.filter(Citoyen.is_active == is_active)
    if fokontany_id:
        query = query.filter(Citoyen.fokontany_id == fokontany_id)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            Citoyen.nom.ilike(pattern) |
            Citoyen.prenom.ilike(pattern) |
            Citoyen.cin.ilike(pattern)
        )
    return query.order_by(Citoyen.nom).offset(skip).limit(limit).all()


@router.post("/", response_model=CitoyenOut, status_code=status.HTTP_201_CREATED)
def create_citoyen(
    body:    CitoyenCreate,
    request: Request,
    db:      Session = Depends(get_db),
    current: Agent = Depends(get_current_agent),
):
    # Vérifier unicité CIN
    if body.cin:
        existing = db.query(Citoyen).filter(Citoyen.cin == body.cin).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"CIN {body.cin} déjà enregistré",
            )

    citoyen = Citoyen(**body.model_dump())
    db.add(citoyen)
    db.commit()
    db.refresh(citoyen)

    log_action(
        db, action="CREATE", entite="Citoyen",
        entite_id=citoyen.id,
        detail=f"Enregistrement citoyen — {citoyen.nom} {citoyen.prenom}",
        agent_id=current.id, ip_address=get_client_ip(request),
    )
    return citoyen


@router.get("/{citoyen_id}", response_model=CitoyenOut)
def get_citoyen(
    citoyen_id: str,
    db:         Session = Depends(get_db),
    _:          Agent = Depends(get_current_agent),
):
    citoyen = db.query(Citoyen).filter(Citoyen.id == citoyen_id).first()
    if not citoyen:
        raise HTTPException(status_code=404, detail="Citoyen introuvable")
    return citoyen


@router.patch("/{citoyen_id}", response_model=CitoyenOut)
def update_citoyen(
    citoyen_id: str,
    body:       CitoyenUpdate,
    request:    Request,
    db:         Session = Depends(get_db),
    current:    Agent = Depends(get_current_agent),
):
    citoyen = db.query(Citoyen).filter(Citoyen.id == citoyen_id).first()
    if not citoyen:
        raise HTTPException(status_code=404, detail="Citoyen introuvable")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(citoyen, field, val)

    db.commit()
    db.refresh(citoyen)

    log_action(
        db, action="UPDATE", entite="Citoyen", entite_id=citoyen_id,
        detail=f"Mise à jour — {citoyen.nom} {citoyen.prenom}",
        agent_id=current.id, ip_address=get_client_ip(request),
    )
    return citoyen


@router.delete("/{citoyen_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_citoyen(
    citoyen_id: str,
    request:    Request,
    db:         Session = Depends(get_db),
    current:    Agent = Depends(get_current_agent),
):
    citoyen = db.query(Citoyen).filter(Citoyen.id == citoyen_id).first()
    if not citoyen:
        raise HTTPException(status_code=404, detail="Citoyen introuvable")

    citoyen.is_active = False   # Soft delete
    db.commit()

    log_action(
        db, action="DELETE", entite="Citoyen", entite_id=citoyen_id,
        detail=f"Désactivation — {citoyen.nom} {citoyen.prenom}",
        agent_id=current.id, ip_address=get_client_ip(request),
        niveau_risque="Élevé",
    )
