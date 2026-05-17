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

from app.core.config import get_db
from app.core.deps import get_current_agent, get_client_ip, require_role
from app.core.security import hash_password, hash_record
from app.models.models import (
    Agent, Alerte, AuditLog, Certificat, DemandePub,
    Fokontany, Transaction, Citoyen, ActeEtatCivil
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
    db: Session = Depends(get_db), current: Agent = Depends(get_current_agent),
):
    # Idempotence — évite les doublons de paiement
    existing = db.query(Transaction).filter(
        Transaction.idempotency_key == body.idempotency_key
    ).first()
    if existing:
        return existing  # Retourne l'existante sans erreur

    txn = Transaction(
        reference=gen_reference("TXN"),
        citoyen_id=body.citoyen_id,
        agent_id=current.id,
        type_paiement=body.type_paiement,
        montant=body.montant,
        idempotency_key=body.idempotency_key,
        reference_externe=body.reference_externe,
        statut="Confirmé",
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    log_action(
        db, action="VALIDATE", entite="Transaction", entite_id=txn.id,
        detail=f"Paiement {body.type_paiement} — {body.montant} Ar — {txn.reference}",
        agent_id=current.id, ip_address=get_client_ip(request), niveau_risque="Moyen",
    )
    return txn


@router_txn.get("/stats/total")
def total_taxes(db: Session = Depends(get_db), _: Agent = Depends(get_current_agent)):
    total = db.query(func.sum(Transaction.montant)).filter(
        Transaction.statut == "Confirmé"
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
    db: Session = Depends(get_db), _: Agent = Depends(get_current_agent),
):
    q = db.query(Certificat)
    if statut:
        q = q.filter(Certificat.statut == statut)
    if type_cert:
        q = q.filter(Certificat.type_cert == type_cert)
    return q.order_by(Certificat.created_at.desc()).offset(skip).limit(limit).all()


@router_cert.post("/", response_model=CertificatOut, status_code=201)
def create_certificat(
    body: CertificatCreate, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(get_current_agent),
):
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
    db.commit()
    db.refresh(cert)

    log_action(
        db, action="CREATE", entite="Certificat", entite_id=cert.id,
        detail=f"Nouveau certificat {body.type_cert} — {cert.reference}",
        agent_id=current.id, ip_address=get_client_ip(request),
    )
    return cert


@router_cert.patch("/{cert_id}", response_model=CertificatOut)
def update_certificat(
    cert_id: str, body: CertificatUpdate, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(get_current_agent),
):
    cert = db.query(Certificat).filter(Certificat.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificat introuvable")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cert, k, v)
    cert.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cert)
    log_action(db, "UPDATE", "Certificat", cert_id,
               f"Mise à jour certificat {cert.reference}", current.id, get_client_ip(request))
    return cert


@router_cert.post("/{cert_id}/delivrer", response_model=CertificatOut)
def delivrer(
    cert_id: str, request: Request,
    db: Session = Depends(get_db), current: Agent = Depends(get_current_agent),
):
    cert = db.query(Certificat).filter(Certificat.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificat introuvable")
    cert.statut = "Délivré"
    cert.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cert)
    log_action(db, "VALIDATE", "Certificat", cert_id,
               f"Délivrance {cert.type_cert} — {cert.reference}", current.id, get_client_ip(request))
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
    db: Session = Depends(get_db), current: Agent = Depends(get_current_agent),
):
    alerte = Alerte(**body.model_dump(), created_by=current.id)
    db.add(alerte)
    db.commit()
    db.refresh(alerte)
    log_action(db, "ALERT", "Alerte", str(alerte.id),
               f"Publication alerte {body.type_alerte} — {body.titre}",
               current.id, get_client_ip(request))
    return alerte


@router_alertes.patch("/{alerte_id}/desactiver")
def desactiver_alerte(
    alerte_id: int, db: Session = Depends(get_db), current: Agent = Depends(get_current_agent),
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
ADMIN_ROLES = ("Administrateur", "Ministère MID")


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
    db.commit()
    db.refresh(agent)
    log_action(db, "CREATE", "Agent", str(agent.id),
               f"Création agent {matricule} — {body.nom} {body.prenom}",
               current.id, get_client_ip(request))
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
    db.commit()
    db.refresh(agent)
    log_action(db, "UPDATE", "Agent", str(agent_id),
               f"Mise à jour agent {agent.matricule}", current.id, get_client_ip(request))
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
    db.commit()
    log_action(db, "DELETE", "Agent", str(agent_id),
               f"Désactivation agent {agent.matricule}", current.id, get_client_ip(request), "Élevé")


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
            Transaction.statut == "Confirmé"
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
    db: Session = Depends(get_db), current: Agent = Depends(get_current_agent),
):
    """
    Endpoint de synchronisation offline-first.
    Algorithme Last Write Wins (LWW) basé sur timestamp.
    Vérifie l'intégrité SHA-256 de chaque enregistrement.
    """
    accepted, conflicts, errors = [], [], []

    for record in body.records:
        try:
            # 1. Vérifier intégrité SHA-256
            computed_hash = hash_record({k: str(v) for k, v in record.data.items()})
            if computed_hash != record.hash:
                errors.append(record.entity_id)
                continue

            # 2. LWW : comparer timestamps
            client_ts = datetime.fromisoformat(record.timestamp)

            if record.entity_type == "acte":
                existing = db.query(ActeEtatCivil).filter(
                    ActeEtatCivil.id == record.entity_id
                ).first()
                if existing and existing.last_update > client_ts:
                    conflicts.append(record.entity_id)  # Serveur plus récent → ignorer
                    continue
                # Sinon appliquer
                if existing:
                    for k, v in record.data.items():
                        if hasattr(existing, k):
                            setattr(existing, k, v)
                    existing.last_update = client_ts
                accepted.append(record.entity_id)

            elif record.entity_type == "citoyen":
                existing = db.query(Citoyen).filter(Citoyen.id == record.entity_id).first()
                if existing and existing.last_update > client_ts:
                    conflicts.append(record.entity_id)
                    continue
                if existing:
                    for k, v in record.data.items():
                        if hasattr(existing, k):
                            setattr(existing, k, v)
                    existing.last_update = client_ts
                accepted.append(record.entity_id)

            db.commit()

        except Exception as e:
            db.rollback()
            errors.append(record.entity_id)

    log_action(
        db, action="SYNC", entite="Sync",
        detail=f"Sync: {len(accepted)} acceptés, {len(conflicts)} conflits, {len(errors)} erreurs",
        agent_id=current.id, ip_address=get_client_ip(request),
    )

    return SyncResponse(accepted=accepted, conflicts=conflicts, errors=errors)


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
    q = db.query(DemandeSvc)
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
    current: Agent = Depends(get_current_agent),
):
    d = db.query(DemandeSvc).filter(DemandeSvc.id == demande_id).first()
    if not d:
        raise HTTPException(404, "Demande introuvable")
    VALID = ["En traitement", "Approuvée", "Rejetée", "Prête"]
    if body.statut not in VALID:
        raise HTTPException(422, f"Statut invalide. Valeurs : {VALID}")

    ancien_statut = d.statut
    d.statut      = body.statut
    d.agent_id    = current.id
    if body.note_agent:
        d.note_agent = body.note_agent
    if body.document_final:
        d.document_final = body.document_final

    db.commit()

    if ancien_statut != d.statut:
        try:
            notify_on_demande_transition(db, d, ancien_statut, d.statut)
        except Exception as exc:
            print(f"Erreur notification transition statut: {exc}")

    if not body.document_final and d.statut in ["Approuvée", "Prête"]:
        try:
            doc = DocumentGenerationService.create_or_update_document(db, d, agent_id=current.id)
            if doc and not d.document_final:
                d.document_final = doc.url_telechargement
                db.commit()
        except Exception as exc:
            print(f"Erreur génération document automatique: {exc}")

    return {"message": "Demande mise à jour", "statut": d.statut, "reference": d.reference}


@router_demandes.get("/stats", response_model=dict)
def stats_demandes(
    db: Session = Depends(get_db),
    _: Agent = Depends(get_current_agent),
):
    from sqlalchemy import func
    total     = db.query(func.count(DemandeSvc.id)).scalar() or 0
    soumises  = db.query(func.count(DemandeSvc.id)).filter(DemandeSvc.statut == "Soumise").scalar() or 0
    traitement= db.query(func.count(DemandeSvc.id)).filter(DemandeSvc.statut == "En traitement").scalar() or 0
    pretes    = db.query(func.count(DemandeSvc.id)).filter(DemandeSvc.statut == "Prête").scalar() or 0
    return {"total": total, "soumises": soumises, "en_traitement": traitement, "pretes": pretes}
