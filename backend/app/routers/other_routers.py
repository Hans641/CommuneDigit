"""
CommuneDigit — Routers groupés :
  /api/transactions, /api/certificats, /api/alertes,
  /api/agents, /api/sync, /api/dashboard, /api/public
"""
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.core.config import get_db
from app.core.deps import get_current_agent, get_client_ip, require_role
from app.core.security import hash_password
from app.models.models import (
    Agent, Alerte, AuditLog, Certificat, DemandePub,
    Fokontany, Transaction, Citoyen, ActeEtatCivil, EvenementDemande
)
from app.schemas.schemas import (
    AgentCreate, AgentOut, AgentUpdate,
    AlerteCreate, AlerteOut,
    AuditLogOut,
    CertificatCreate, CertificatOut, CertificatUpdate,
    DashboardStats, DemandeCreate, DemandeOut,
    FokontanyCreate, FokontanyOut,
    SyncRequest, SyncResponse,
    TransactionCreate, TransactionOut,
)
from app.services.request_policy import (
    scoped_requests, validate_transition, OPERATORS, APPROVERS, scoped_records, linked_citizen,
)
from app.services.audit_service import log_action
from app.services.ref_service import gen_matricule, gen_reference, gen_idempotency_key


# ══════════════════════════════════════════════════════
#  TRANSACTIONS
# ══════════════════════════════════════════════════════
router_txn = APIRouter(prefix="/transactions", tags=["Paiements"])


@router_txn.get("/", response_model=List[TransactionOut])
def list_transactions(
    skip: int = 0, limit: int = 50,
    statut: Optional[str] = None,
    db: Session = Depends(get_db), _: Agent = Depends(get_current_agent),
):
    q = db.query(Transaction)
    if statut:
        q = q.filter(Transaction.statut == statut)
    return q.order_by(Transaction.created_at.desc()).offset(skip).limit(limit).all()


@router_txn.post("/", response_model=TransactionOut, status_code=201)
def create_transaction(
    body: TransactionCreate, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(require_role(*APPROVERS)),
):
    if body.type_paiement == "Démo" or body.idempotency_key.startswith("demo:"):
        raise HTTPException(422, "Utilisez le parcours de simulation dédié")
    def same_transaction(txn):
        return (txn.citoyen_id == body.citoyen_id and txn.montant == body.montant
                and txn.type_paiement == body.type_paiement
                and txn.reference_externe == body.reference_externe)

    existing = db.query(Transaction).filter(Transaction.idempotency_key == body.idempotency_key).first()
    if existing:
        if not same_transaction(existing):
            raise HTTPException(409, "Clé d'idempotence utilisée avec un autre contenu")
        return existing
    if body.citoyen_id and not db.get(Citoyen, body.citoyen_id):
        raise HTTPException(422, "Citoyen introuvable")
    txn = Transaction(
        reference=gen_reference("TXN"), citoyen_id=body.citoyen_id, agent_id=current.id,
        type_paiement=body.type_paiement, montant=body.montant,
        idempotency_key=body.idempotency_key, reference_externe=body.reference_externe,
        statut="Confirmé",
    )
    try:
        db.add(txn)
        db.flush()
        log_action(
            db, action="VALIDATE", entite="Transaction", entite_id=txn.id,
            detail=f"Encaissement manuel — {txn.montant} Ar — {txn.reference}",
            agent_id=current.id, ip_address=get_client_ip(request), niveau_risque="Moyen",
            commit=False,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(Transaction).filter(Transaction.idempotency_key == body.idempotency_key).first()
        if existing and same_transaction(existing):
            return existing
        raise HTTPException(409, "Encaissement concurrent ou clé déjà utilisée")
    db.refresh(txn)
    return txn


@router_txn.get("/stats/total")
def total_taxes(db: Session = Depends(get_db), _: Agent = Depends(get_current_agent)):
    total = db.query(func.sum(Transaction.montant)).filter(
        Transaction.statut == "Confirmé", Transaction.type_paiement != "Démo"
    ).scalar() or 0
    return {"total_ariary": total}


# ══════════════════════════════════════════════════════
#  CERTIFICATS
# ══════════════════════════════════════════════════════
router_cert = APIRouter(prefix="/certificats", tags=["Certificats"])

TARIFS_CERT = {"Résidence": 2000, "Héritage": 5000, "Permis": 10000, "Autre": 0}


@router_cert.get("/", response_model=List[CertificatOut])
def list_certificats(
    skip: int = 0, limit: int = 50,
    statut: Optional[str] = None,
    type_cert: Optional[str] = None,
    db: Session = Depends(get_db), current: Agent = Depends(get_current_agent),
):
    q = scoped_records(db, current, Certificat)
    if statut:
        q = q.filter(Certificat.statut == statut)
    if type_cert:
        q = q.filter(Certificat.type_cert == type_cert)
    return q.order_by(Certificat.created_at.desc()).offset(skip).limit(limit).all()


@router_cert.post("/", response_model=CertificatOut, status_code=201)
def create_certificat(
    body: CertificatCreate, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(require_role(*OPERATORS)),
):
    linked_citizen(db, current, body.citoyen_id)
    prix = body.prix if body.prix > 0 else TARIFS_CERT.get(body.type_cert, 0)
    cert = Certificat(
        reference=gen_reference("CRT"),
        type_cert=body.type_cert,
        citoyen_id=body.citoyen_id,
        motif=body.motif,
        prix=prix,
        agent_id=current.id,
        statut="En attente",
    )
    db.add(cert)

    db.flush()
    log_action(
        db,
        action="CREATE",
        entite="Certificat",
        entite_id=cert.id,
        detail=f"Nouveau certificat {body.type_cert} — {cert.reference}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(cert)
    return cert


@router_cert.patch("/{cert_id}", response_model=CertificatOut)
def update_certificat(
    cert_id: str, body: CertificatUpdate, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(require_role(*OPERATORS)),
):
    cert = scoped_records(db, current, Certificat).filter(Certificat.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificat introuvable")
    if body.statut is not None and current.role not in APPROVERS:
        raise HTTPException(403, "Changement de statut réservé aux responsables")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cert, k, v)
    cert.updated_at = datetime.utcnow()
    db.flush()
    log_action(
        db,
        action="UPDATE",
        entite="Certificat",
        entite_id=cert_id,
        detail=f"Mise à jour certificat {cert.reference}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(cert)
    return cert


@router_cert.post("/{cert_id}/delivrer", response_model=CertificatOut)
def delivrer(
    cert_id: str, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(require_role(*APPROVERS)),
):
    cert = scoped_records(db, current, Certificat).filter(Certificat.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificat introuvable")
    cert.statut = "Délivré"
    cert.updated_at = datetime.utcnow()
    db.flush()
    log_action(
        db,
        action="VALIDATE",
        entite="Certificat",
        entite_id=cert_id,
        detail=f"Délivrance {cert.type_cert} — {cert.reference}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(cert)
    return cert


# ══════════════════════════════════════════════════════
#  ALERTES
# ══════════════════════════════════════════════════════
router_alertes = APIRouter(prefix="/alertes", tags=["Alertes"])


@router_alertes.get("/", response_model=List[AlerteOut])
def list_alertes(
    statut: Optional[str] = None,
    db: Session = Depends(get_db), _: Agent = Depends(get_current_agent),
):
    q = db.query(Alerte)
    if statut:
        q = q.filter(Alerte.statut == statut)
    return q.order_by(Alerte.created_at.desc()).all()


@router_alertes.post("/", response_model=AlerteOut, status_code=201)
def create_alerte(
    body: AlerteCreate, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(require_role(*OPERATORS)),
):
    alerte = Alerte(**body.model_dump(), created_by=current.id)
    db.add(alerte)
    db.flush()
    log_action(
        db,
        action="ALERT",
        entite="Alerte",
        entite_id=str(alerte.id),
        detail=f"Publication alerte {body.type_alerte} — {body.titre}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(alerte)
    return alerte


@router_alertes.patch("/{alerte_id}/desactiver")
def desactiver_alerte(
    alerte_id: int, db: Session = Depends(get_db), current: Agent = Depends(require_role(*OPERATORS)),
):
    alerte = db.query(Alerte).filter(Alerte.id == alerte_id).first()
    if not alerte:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    alerte.statut = "Expirée"
    db.commit()
    return {"message": "Alerte désactivée"}


# ══════════════════════════════════════════════════════
#  AGENTS (admin only)
# ══════════════════════════════════════════════════════
router_agents = APIRouter(prefix="/agents", tags=["Agents"])
ADMIN_ROLES = ("Administrateur",)


@router_agents.get("/", response_model=List[AgentOut])
def list_agents(
    db: Session = Depends(get_db),
    _: Agent = Depends(require_role(*ADMIN_ROLES)),
):
    return db.query(Agent).order_by(Agent.nom).all()


@router_agents.post("/", response_model=AgentOut, status_code=201)
def create_agent(
    body: AgentCreate, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(require_role(*ADMIN_ROLES)),
):
    matricule = gen_matricule(db)
    agent = Agent(
        matricule=matricule,
        nom=body.nom,
        prenom=body.prenom,
        role=body.role,
        fokontany=body.fokontany,
        telephone=body.telephone,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(agent)
    db.flush()
    log_action(
        db,
        action="CREATE",
        entite="Agent",
        entite_id=str(agent.id),
        detail=f"Création agent {matricule} — {body.nom} {body.prenom}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(agent)
    return agent


@router_agents.patch("/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: int, body: AgentUpdate, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(require_role(*ADMIN_ROLES)),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent introuvable")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(agent, k, v)
    db.flush()
    log_action(
        db,
        action="UPDATE",
        entite="Agent",
        entite_id=str(agent_id),
        detail=f"Mise à jour agent {agent.matricule}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(agent)
    return agent


@router_agents.delete("/{agent_id}", status_code=204)
def disable_agent(
    agent_id: int, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(require_role(*ADMIN_ROLES)),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent introuvable")
    if agent.id == current.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas désactiver votre propre compte")
    agent.is_active = False
    db.flush()
    log_action(
        db,
        action="DELETE",
        entite="Agent",
        entite_id=str(agent_id),
        detail=f"Désactivation agent {agent.matricule}",
        agent_id=current.id,
        ip_address=get_client_ip(request),
        niveau_risque="Élevé",
        commit=False,
    )
    db.commit()


# ══════════════════════════════════════════════════════
#  FOKONTANY
# ══════════════════════════════════════════════════════
router_fokontany = APIRouter(prefix="/fokontany", tags=["Fokontany"])


@router_fokontany.get("/", response_model=List[FokontanyOut])
def list_fokontany(db: Session = Depends(get_db), _: Agent = Depends(get_current_agent)):
    return db.query(Fokontany).all()


@router_fokontany.post("/", response_model=FokontanyOut, status_code=201)
def create_fokontany(
    body: FokontanyCreate, db: Session = Depends(get_db),
    _: Agent = Depends(require_role(*ADMIN_ROLES)),
):
    fok = Fokontany(**body.model_dump())
    db.add(fok)
    db.commit()
    db.refresh(fok)
    return fok


# ══════════════════════════════════════════════════════
#  AUDIT LOG
# ══════════════════════════════════════════════════════
router_audit = APIRouter(prefix="/audit", tags=["Audit"])


@router_audit.get("/", response_model=List[AuditLogOut])
def list_audit(
    skip: int = 0, limit: int = 100,
    action: Optional[str] = None,
    niveau_risque: Optional[str] = None,
    db: Session = Depends(get_db),
    _: Agent = Depends(require_role(*ADMIN_ROLES)),
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if niveau_risque:
        q = q.filter(AuditLog.niveau_risque == niveau_risque)
    return q.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()


# ══════════════════════════════════════════════════════
#  DASHBOARD STATS
# ══════════════════════════════════════════════════════
router_dashboard = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router_dashboard.get("/stats", response_model=DashboardStats)
def dashboard_stats(
    db: Session = Depends(get_db), _: Agent = Depends(get_current_agent),
):
    from datetime import date, timedelta
    debut_mois = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)

    return DashboardStats(
        total_citoyens=db.query(Citoyen).filter(Citoyen.is_active == True).count(),
        actes_ce_mois=db.query(ActeEtatCivil).filter(
            ActeEtatCivil.created_at >= debut_mois
        ).count(),
        dossiers_en_attente=db.query(ActeEtatCivil).filter(
            ActeEtatCivil.statut == "En attente"
        ).count(),
        taxes_collectees=db.query(func.sum(Transaction.montant)).filter(
            Transaction.statut == "Confirmé", Transaction.type_paiement != "Démo"
        ).scalar() or 0,
        agents_actifs=db.query(Agent).filter(Agent.is_active == True).count(),
        fokontany_connectes=db.query(Fokontany).filter(Fokontany.is_online == True).count(),
        alertes_actives=db.query(Alerte).filter(Alerte.statut == "Active").count(),
    )


# ══════════════════════════════════════════════════════
#  SYNC OFFLINE-FIRST (LWW)
# ══════════════════════════════════════════════════════
router_sync = APIRouter(prefix="/sync", tags=["Synchronisation"])


@router_sync.post("/", response_model=SyncResponse)
def sync_data(
    body: SyncRequest, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(require_role(*OPERATORS)),
):
    from app.services.sync_service import push_records
    return push_records(db, current, body.records, get_client_ip(request))


@router_sync.get("/{entity_type}", summary="Récupérer les changements autorisés")
def sync_changes(
    entity_type: str,
    version: Optional[int] = Query(None, ge=0, le=9223372036854775807),
    scope: Optional[str] = None,
    after_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current: Agent = Depends(get_current_agent),
):
    from app.services.sync_service import pull_records
    return pull_records(db, current, entity_type, version, after_id, scope, limit)


# ══════════════════════════════════════════════════════
#  PUBLIC (sans auth — citoyens)
# ══════════════════════════════════════════════════════
router_public = APIRouter(prefix="/public", tags=["Public"])


@router_public.post("/demandes", response_model=DemandeOut, status_code=201,
                    summary="Soumettre une demande (sans compte)")
def soumettre_demande(body: DemandeCreate, db: Session = Depends(get_db)):
    ref = gen_reference("CD")
    demande = DemandePub(**body.model_dump(), reference=ref)
    db.add(demande)
    db.commit()
    db.refresh(demande)
    return demande


@router_public.get("/demandes/{reference}", summary="Suivre une demande par référence")
def suivre_demande(reference: str, db: Session = Depends(get_db)):
    demande = db.query(DemandePub).filter(DemandePub.reference == reference).first()
    if not demande:
        raise HTTPException(status_code=404, detail="Demande introuvable. Vérifiez la référence.")
    return {
        "reference": demande.reference,
        "service": demande.service,
        "statut": demande.statut,
        "nom": f"{demande.nom} {demande.prenom}",
        "created_at": demande.created_at,
        "updated_at": demande.updated_at,
    }


@router_public.get("/alertes/actives", response_model=List[AlerteOut],
                   summary="Alertes actives (sans auth)")
def alertes_publiques(db: Session = Depends(get_db)):
    return db.query(Alerte).filter(Alerte.statut == "Active").all()


# ══════════════════════════════════════════════════════
#  ESPACE AGENT — Traitement des demandes citoyens
# ══════════════════════════════════════════════════════
from app.models.models import DemandeService as DemandeSvc, CatalogueService as CatSvc, CompteCitoyen as CptCit
from app.services.notification_service import notify_on_demande_transition
from app.services.document_service import DocumentGenerationService

router_demandes = APIRouter(prefix="/demandes-citoyens", tags=["Demandes Citoyens"])


class TraitementBody(BaseModel):
    statut: str  # "En traitement" | "Approuvée" | "Rejetée" | "Prête"
    note_agent: Optional[str] = None
    document_final: Optional[str] = None


@router_demandes.get("/", response_model=list)
def list_demandes_agent(
    statut: Optional[str] = None,
    service_code: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current: Agent = Depends(get_current_agent),
):
    q = scoped_requests(db, current)
    if statut:       q = q.filter(DemandeSvc.statut == statut)
    if service_code: q = q.filter(DemandeSvc.service_code == service_code)
    demandes = q.order_by(DemandeSvc.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for d in demandes:
        svc = d.service
        citoyen = d.citoyen
        result.append({
            "id": d.id,
            "reference": d.reference,
            "service_code": d.service_code,
            "service_nom": svc.nom if svc else d.service_code,
            "service_icone": svc.icone if svc else "📄",
            "citoyen_nom": f"{citoyen.nom} {citoyen.prenom}" if citoyen else "—",
            "citoyen_tel": citoyen.telephone if citoyen else "—",
            "statut": d.statut,
            "statut_paiement": d.statut_paiement,
            "montant_ar": d.montant_ar,
            "pieces_jointes": d.pieces_jointes or [],
            "donnees": d.donnees_json,
            "note_agent": d.note_agent,
            "document_final": d.document_final,
            "created_at": d.created_at.isoformat(),
            "soumise_at": d.soumise_at.isoformat() if d.soumise_at else None,
        })
    return result


@router_demandes.patch("/{demande_id}", response_model=dict)
def traiter_demande(
    demande_id: str,
    body: TraitementBody,
    db: Session = Depends(get_db),
    current: Agent = Depends(require_role(*OPERATORS)),
):
    d = scoped_requests(db, current).filter(DemandeSvc.id == demande_id).with_for_update().first()
    if not d:
        raise HTTPException(404, "Demande introuvable")
    validate_transition(d, body.statut, current)
    if body.document_final:
        raise HTTPException(422, "Le document final doit être généré par le serveur")
    ancien_statut = d.statut
    if ancien_statut == body.statut:
        return {"message": "Statut inchangé", "statut": d.statut, "reference": d.reference}
    try:
        d.statut = body.statut
        d.agent_id = current.id
        if body.note_agent is not None:
            d.note_agent = body.note_agent
        db.add(EvenementDemande(
            demande_id=d.id, type_event="TRANSITION_STATUT", ancien_statut=ancien_statut,
            nouveau_statut=d.statut, agent_id=current.id, description=body.note_agent,
        ))
        if d.statut == "Prête":
            doc = DocumentGenerationService.create_or_update_document(db, d, agent_id=current.id, commit=False)
            if doc is None:
                raise RuntimeError("Stockage du document impossible")
        notify_on_demande_transition(db, d, ancien_statut, d.statut, commit=False)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(500, "Traitement impossible, aucune transition enregistrée")
    return {"message": "Demande mise à jour", "statut": d.statut, "reference": d.reference}


@router_demandes.get("/stats", response_model=dict)
def stats_demandes(
    db: Session = Depends(get_db),
    current: Agent = Depends(get_current_agent),
):
    from sqlalchemy import func
    query = scoped_requests(db, current)
    total     = query.with_entities(func.count(DemandeSvc.id)).scalar() or 0
    soumises  = query.with_entities(func.count(DemandeSvc.id)).filter(DemandeSvc.statut == "Soumise").scalar() or 0
    traitement= query.with_entities(func.count(DemandeSvc.id)).filter(DemandeSvc.statut == "En traitement").scalar() or 0
    pretes    = query.with_entities(func.count(DemandeSvc.id)).filter(DemandeSvc.statut == "Prête").scalar() or 0
    return {"total": total, "soumises": soumises, "en_traitement": traitement, "pretes": pretes}


@router_demandes.get("/{demande_id}/pieces/{index}")
def telecharger_piece_agent(
    demande_id: str,
    index: int,
    db: Session = Depends(get_db),
    current: Agent = Depends(get_current_agent),
):
    from fastapi.responses import FileResponse
    from app.services.file_service import FileService

    demande = scoped_requests(db, current).filter(DemandeSvc.id == demande_id).first()
    if not demande or index < 0 or index >= len(demande.pieces_jointes or []):
        raise HTTPException(404, "Pièce jointe introuvable")
    piece = demande.pieces_jointes[index]
    url = piece.get("url", "")
    path = (FileService.get_file_path(url) if url.startswith("/uploads/")
            else DocumentGenerationService.get_document_file(url))
    if not path:
        raise HTTPException(404, "Fichier introuvable")
    return FileResponse(path, media_type="application/octet-stream", filename=path.name)
