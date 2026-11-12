"""
CommuneDigit — Router : Actes d'État Civil
Naissances, Mariages, Décès — avec hachage SHA-256
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.core.deps import get_current_agent, get_client_ip, require_role
from app.core.security import acte_integrity_hash
from app.services.sync_service import utc
from app.models.models import ActeEtatCivil, Agent
from app.schemas.schemas import ActeCreate, ActeOut, ActeUpdate
from app.services.request_policy import (
    OPERATORS, APPROVERS, scoped_records, validate_record_territory, linked_citizen,
)
from app.services.audit_service import log_action
from app.services.ref_service import gen_reference

router = APIRouter(prefix="/actes", tags=["État Civil"])


@router.get("/", response_model=List[ActeOut], summary="Lister les actes")
def list_actes(
    type_acte:  Optional[str] = Query(None, description="Naissance|Mariage|Décès"),
    statut:     Optional[str] = Query(None),
    q:          Optional[str] = Query(None, description="Recherche par nom"),
    skip:       int = Query(0, ge=0),
    limit:      int = Query(50, ge=1, le=200),
    db:         Session = Depends(get_db),
    current:    Agent = Depends(get_current_agent),
):
    query = scoped_records(db, current, ActeEtatCivil)
    if type_acte:
        query = query.filter(ActeEtatCivil.type_acte == type_acte)
    if statut:
        query = query.filter(ActeEtatCivil.statut == statut)
    if q:
        query = query.filter(ActeEtatCivil.nom_concerne.ilike(f"%{q}%"))
    return query.order_by(ActeEtatCivil.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=ActeOut, status_code=status.HTTP_201_CREATED)
def create_acte(
    body:    ActeCreate,
    request: Request,
    db:      Session = Depends(get_db),
    current: Agent = Depends(require_role(*OPERATORS)),
):
    if body.citoyen_id:
        citizen = linked_citizen(db, current, body.citoyen_id)
        if body.fokontany_id is None:
            body.fokontany_id = citizen.fokontany_id
        elif body.fokontany_id != citizen.fokontany_id:
            raise HTTPException(422, "Fokontany incompatible avec le citoyen")
    body.fokontany_id = validate_record_territory(db, current, body.fokontany_id, default=True)
    # Générer référence unique
    reference = gen_reference("EC")

    acte = ActeEtatCivil(
        reference=reference,
        type_acte=body.type_acte,
        nom_concerne=body.nom_concerne,
        date_evenement=utc(body.date_evenement),
        lieu_evenement=body.lieu_evenement,
        details_json=body.details_json,
        citoyen_id=body.citoyen_id,
        fokontany_id=body.fokontany_id,
        agent_id=current.id,
        statut="En attente",
    )
    acte.hash_sha256 = acte_integrity_hash(acte)
    db.add(acte)

    db.flush()
    log_action(
        db,
        action="CREATE",
        entite="ActeEtatCivil",
        entite_id=acte.id,
        detail=f"Nouvel acte {body.type_acte} — {body.nom_concerne} — {reference}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(acte)
    return acte


@router.get("/{acte_id}", response_model=ActeOut)
def get_acte(acte_id: str, db: Session = Depends(get_db), current: Agent = Depends(get_current_agent)):
    acte = scoped_records(db, current, ActeEtatCivil).filter(ActeEtatCivil.id == acte_id).first()
    if not acte:
        raise HTTPException(status_code=404, detail="Acte introuvable")
    return acte


@router.patch("/{acte_id}", response_model=ActeOut)
def update_acte(
    acte_id: str,
    body:    ActeUpdate,
    request: Request,
    db:      Session = Depends(get_db),
    current: Agent = Depends(require_role(*OPERATORS)),
):
    acte = scoped_records(db, current, ActeEtatCivil).filter(ActeEtatCivil.id == acte_id).first()
    if not acte:
        raise HTTPException(status_code=404, detail="Acte introuvable")

    if (body.statut is not None or body.is_validated is not None) and current.role not in APPROVERS:
        raise HTTPException(403, "Validation réservée aux responsables")
    updates = body.model_dump(exclude_none=True)
    for field, val in updates.items():
        setattr(acte, field, val)

    if 'date_evenement' in updates:
        acte.date_evenement = utc(acte.date_evenement)
    acte.hash_sha256 = acte_integrity_hash(acte)

    acte.updated_at = datetime.utcnow()
    acte.last_update = datetime.utcnow()

    db.flush()
    log_action(
        db,
        action="UPDATE",
        entite="ActeEtatCivil",
        entite_id=acte_id,
        detail=f"Mise à jour acte {acte.reference} — statut: {acte.statut}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(acte)
    return acte


@router.post("/{acte_id}/valider", response_model=ActeOut, summary="Valider un acte")
def valider_acte(
    acte_id: str,
    request: Request,
    db:      Session = Depends(get_db),
    current: Agent = Depends(require_role(*APPROVERS)),
):
    acte = scoped_records(db, current, ActeEtatCivil).filter(ActeEtatCivil.id == acte_id).first()
    if not acte:
        raise HTTPException(status_code=404, detail="Acte introuvable")

    acte.statut = "Validé"
    acte.is_validated = True
    acte.last_update = datetime.utcnow()
    acte.updated_at = datetime.utcnow()

    db.flush()
    log_action(
        db,
        action="VALIDATE",
        entite="ActeEtatCivil",
        entite_id=acte_id,
        detail=f"Validation acte {acte.reference} — {acte.nom_concerne}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(acte)
    return acte


@router.get("/stats/summary", summary="Résumé statistique des actes")
def actes_stats(db: Session = Depends(get_db), current: Agent = Depends(get_current_agent)):
    from sqlalchemy import func
    stats = (
        scoped_records(db, current, ActeEtatCivil).with_entities(
            ActeEtatCivil.type_acte, ActeEtatCivil.statut, func.count(ActeEtatCivil.id))
        .group_by(ActeEtatCivil.type_acte, ActeEtatCivil.statut)
        .all()
    )
    result: dict = {}
    for type_acte, statut, count in stats:
        if type_acte not in result:
            result[type_acte] = {}
        result[type_acte][statut] = count
    return result
