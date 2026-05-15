"""
CommuneDigit — Espace Citoyen
Routes dédiées aux citoyens inscrits (CompteCitoyen)
Préfixe : /api/espace-citoyen
"""
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from app.core.config import get_db
from app.core.security import create_access_token, verify_password, hash_password, decode_token
from app.models.models import (
    CompteCitoyen, Citoyen, Fokontany,
    CatalogueService, DemandeService, ProjetCommune, Alerte
)

router = APIRouter(prefix="/espace-citoyen", tags=["Espace Citoyen"])

oauth2_citoyen = OAuth2PasswordBearer(tokenUrl="/api/espace-citoyen/login", auto_error=False)


# ── Auth helper ────────────────────────────────────────────────────
def get_current_citoyen(
    token: str = Depends(oauth2_citoyen),
    db: Session = Depends(get_db),
) -> CompteCitoyen:
    exc = HTTPException(status_code=401, detail="Non authentifié")
    if not token:
        raise exc
    payload = decode_token(token)
    if not payload or payload.get("type") != "citoyen":
        raise exc
    compte = db.query(CompteCitoyen).filter(
        CompteCitoyen.id == int(payload["sub"]),
        CompteCitoyen.is_active == True
    ).first()
    if not compte:
        raise exc
    return compte


# ══════════════════════════════════════════════════════════════════
#  Schémas Pydantic inline
# ══════════════════════════════════════════════════════════════════
class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)
    nom: str = Field(..., min_length=1)
    prenom: str = Field(..., min_length=1)
    telephone: str = Field(..., min_length=8)
    cin: Optional[str] = None
    fokontany_id: Optional[int] = None
    adresse: Optional[str] = None

class LoginCitoyenRequest(BaseModel):
    email: str
    password: str

class DemandeCreate(BaseModel):
    service_code: str
    donnees: Optional[dict] = None
    pieces_jointes: Optional[list] = None   # [{nom, url, type, obtenu_ici}]

class PaiementConfirm(BaseModel):
    reference_paiement: str
    methode: str = "MVola"

class ProfilUpdate(BaseModel):
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    fokontany_id: Optional[int] = None


# ══════════════════════════════════════════════════════════════════
#  INSCRIPTION
# ══════════════════════════════════════════════════════════════════
@router.post("/inscription", status_code=201, summary="Inscription d'un nouveau citoyen")
def inscription(body: RegisterRequest, db: Session = Depends(get_db)):
    # Email unique
    if db.query(CompteCitoyen).filter(CompteCitoyen.email == body.email).first():
        raise HTTPException(400, "Un compte existe déjà avec cet email")

    # Créer la fiche Citoyen
    citoyen = Citoyen(
        nom=body.nom.upper(),
        prenom=body.prenom,
        cin=body.cin,
        telephone=body.telephone,
        adresse=body.adresse,
        fokontany_id=body.fokontany_id,
    )
    db.add(citoyen)
    db.flush()

    # Créer le compte auth
    compte = CompteCitoyen(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        citoyen_id=citoyen.id,
        is_verified=True,   # Vérification email optionnelle en prod
    )
    db.add(compte)
    db.commit()
    db.refresh(compte)

    token = create_access_token({"sub": str(compte.id), "type": "citoyen"})
    return {
        "access_token": token,
        "token_type": "bearer",
        "compte": {
            "id": compte.id,
            "email": compte.email,
            "citoyen_id": citoyen.id,
            "nom": citoyen.nom,
            "prenom": citoyen.prenom,
        }
    }


# ══════════════════════════════════════════════════════════════════
#  CONNEXION
# ══════════════════════════════════════════════════════════════════
@router.post("/login", summary="Connexion espace citoyen")
def login_citoyen(body: LoginCitoyenRequest, db: Session = Depends(get_db)):
    compte = db.query(CompteCitoyen).filter(
        CompteCitoyen.email == body.email.lower(),
        CompteCitoyen.is_active == True
    ).first()
    if not compte or not verify_password(body.password, compte.hashed_password):
        raise HTTPException(401, "Email ou mot de passe incorrect")

    compte.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(compte.id), "type": "citoyen"})
    citoyen = compte.citoyen

    return {
        "access_token": token,
        "token_type": "bearer",
        "compte": {
            "id": compte.id,
            "email": compte.email,
            "citoyen_id": citoyen.id if citoyen else None,
            "nom": citoyen.nom if citoyen else "",
            "prenom": citoyen.prenom if citoyen else "",
            "telephone": citoyen.telephone if citoyen else "",
            "cin": citoyen.cin if citoyen else "",
            "fokontany": citoyen.fokontany_rel.nom if citoyen and citoyen.fokontany_rel else "",
        }
    }


# ══════════════════════════════════════════════════════════════════
#  PROFIL
# ══════════════════════════════════════════════════════════════════
@router.get("/profil", summary="Mon profil")
def get_profil(compte: CompteCitoyen = Depends(get_current_citoyen), db: Session = Depends(get_db)):
    c = compte.citoyen
    return {
        "id": compte.id,
        "email": compte.email,
        "nom": c.nom if c else "",
        "prenom": c.prenom if c else "",
        "cin": c.cin if c else None,
        "telephone": c.telephone if c else "",
        "adresse": c.adresse if c else "",
        "fokontany": c.fokontany_rel.nom if c and c.fokontany_rel else "",
        "fokontany_id": c.fokontany_id if c else None,
        "created_at": compte.created_at.isoformat(),
    }

@router.patch("/profil", summary="Mettre à jour mon profil")
def update_profil(
    body: ProfilUpdate,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db)
):
    c = compte.citoyen
    if not c:
        raise HTTPException(404, "Fiche citoyen introuvable")
    if body.telephone: c.telephone = body.telephone
    if body.adresse:   c.adresse   = body.adresse
    if body.fokontany_id: c.fokontany_id = body.fokontany_id
    db.commit()
    return {"message": "Profil mis à jour"}


# ══════════════════════════════════════════════════════════════════
#  PROJETS COMMUNE (publics)
# ══════════════════════════════════════════════════════════════════
@router.get("/projets", summary="Projets de la commune")
def list_projets(
    statut: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(ProjetCommune).filter(ProjetCommune.is_visible == True)
    if statut:
        q = q.filter(ProjetCommune.statut == statut)
    return q.order_by(ProjetCommune.created_at.desc()).all()


# ══════════════════════════════════════════════════════════════════
#  ALERTES (publiques)
# ══════════════════════════════════════════════════════════════════
@router.get("/alertes", summary="Alertes actives")
def list_alertes_pub(db: Session = Depends(get_db)):
    return db.query(Alerte).filter(Alerte.statut == "Active").order_by(Alerte.created_at.desc()).limit(10).all()


# ══════════════════════════════════════════════════════════════════
#  CATALOGUE DES SERVICES
# ══════════════════════════════════════════════════════════════════
@router.get("/catalogue", summary="Catalogue des services administratifs")
def catalogue(
    categorie: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(CatalogueService).filter(CatalogueService.is_active == True)
    if categorie:
        q = q.filter(CatalogueService.categorie == categorie)
    return q.order_by(CatalogueService.categorie, CatalogueService.nom).all()

@router.get("/catalogue/{code}", summary="Détail d'un service")
def get_service(code: str, db: Session = Depends(get_db)):
    svc = db.query(CatalogueService).filter(CatalogueService.code == code).first()
    if not svc:
        raise HTTPException(404, "Service introuvable")
    return svc


# ══════════════════════════════════════════════════════════════════
#  DEMANDES
# ══════════════════════════════════════════════════════════════════
def gen_ref_demande():
    return f"DEM-{datetime.utcnow().strftime('%y%m')}-{str(uuid.uuid4())[:6].upper()}"


@router.post("/demandes", status_code=201, summary="Soumettre une demande")
def creer_demande(
    body: DemandeCreate,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    svc = db.query(CatalogueService).filter(CatalogueService.code == body.service_code).first()
    if not svc:
        raise HTTPException(404, "Service non trouvé dans le catalogue")

    # Vérifier que les documents requis sont fournis
    requis = svc.documents_requis or []
    for doc in requis:
        if doc.get("obligatoire", True):
            fourni = any(
                pj.get("type") == doc["code"] or pj.get("code") == doc["code"]
                for pj in (body.pieces_jointes or [])
            )
            if not fourni:
                detail_message = f"Document requis manquant : {doc['label']} ({doc['code']})."
                if doc.get('obtainable_here'):
                    detail_message += " Vous pouvez l'obtenir sur cette plateforme."
                raise HTTPException(
                    status_code=422,
                    detail=detail_message
                )

    demande = DemandeService(
        reference=gen_ref_demande(),
        compte_id=compte.id,
        citoyen_id=compte.citoyen_id,
        service_code=body.service_code,
        donnees_json=body.donnees or {},
        pieces_jointes=body.pieces_jointes or [],
        montant_ar=svc.prix_ar,
        statut="Soumise",
        soumise_at=datetime.utcnow(),
    )
    db.add(demande)
    db.commit()
    db.refresh(demande)
    return {
        "reference": demande.reference,
        "statut": demande.statut,
        "montant_ar": demande.montant_ar,
        "message": "Demande soumise avec succès. Vous serez notifié par SMS."
    }


@router.get("/demandes", summary="Mes demandes")
def mes_demandes(
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    demandes = (
        db.query(DemandeService)
        .filter(DemandeService.compte_id == compte.id)
        .order_by(DemandeService.created_at.desc())
        .all()
    )
    result = []
    for d in demandes:
        svc = d.service
        result.append({
            "id": d.id,
            "reference": d.reference,
            "service_code": d.service_code,
            "service_nom": svc.nom if svc else d.service_code,
            "service_icone": svc.icone if svc else "📄",
            "statut": d.statut,
            "statut_paiement": d.statut_paiement,
            "montant_ar": d.montant_ar,
            "note_agent": d.note_agent,
            "document_final": d.document_final,
            "created_at": d.created_at.isoformat(),
            "soumise_at": d.soumise_at.isoformat() if d.soumise_at else None,
            "pieces_jointes": d.pieces_jointes or [],
        })
    return result


@router.get("/demandes/{demande_id}", summary="Détail d'une demande")
def get_demande(
    demande_id: str,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    d = db.query(DemandeService).filter(
        DemandeService.id == demande_id,
        DemandeService.compte_id == compte.id,
    ).first()
    if not d:
        raise HTTPException(404, "Demande introuvable")
    svc = d.service
    return {
        "id": d.id,
        "reference": d.reference,
        "service": {
            "code": svc.code,
            "nom": svc.nom,
            "nom_mg": svc.nom_mg,
            "icone": svc.icone,
            "documents_requis": svc.documents_requis,
        } if svc else {},
        "donnees": d.donnees_json,
        "pieces_jointes": d.pieces_jointes or [],
        "montant_ar": d.montant_ar,
        "statut": d.statut,
        "statut_paiement": d.statut_paiement,
        "note_agent": d.note_agent,
        "document_final": d.document_final,
        "created_at": d.created_at.isoformat(),
    }


@router.post("/demandes/{demande_id}/payer", summary="Confirmer le paiement")
def payer_demande(
    demande_id: str,
    body: PaiementConfirm,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    d = db.query(DemandeService).filter(
        DemandeService.id == demande_id,
        DemandeService.compte_id == compte.id,
    ).first()
    if not d:
        raise HTTPException(404, "Demande introuvable")
    if d.statut_paiement == "Payé":
        raise HTTPException(400, "Déjà payé")
    d.statut_paiement = "Payé"
    d.reference_paiement = body.reference_paiement
    if d.statut == "Soumise":
        d.statut = "En traitement"
    db.commit()
    return {"message": "Paiement confirmé", "reference": d.reference}


# ══════════════════════════════════════════════════════════════════
#  FOKONTANY (pour le formulaire d'inscription)
# ══════════════════════════════════════════════════════════════════
@router.get("/fokontany", summary="Liste des fokontany")
def list_fokontany(db: Session = Depends(get_db)):
    return db.query(Fokontany).filter(Fokontany.is_online == True).all()
