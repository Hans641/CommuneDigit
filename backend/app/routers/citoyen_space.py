"""
CommuneDigit — Espace Citoyen
Routes dédiées aux citoyens inscrits (CompteCitoyen)
Préfixe : /api/espace-citoyen
"""
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from app.core.config import get_db, get_settings
from app.core.security import create_access_token, verify_password, hash_password, decode_token, password_session_stamp
from app.models.models import (
    CompteCitoyen, Citoyen, Fokontany,
    CatalogueService, DemandeService, ProjetCommune, Alerte, Notification, FichierCitoyen, DocumentFinal, EvenementDemande, Transaction, PaiementDemande
)
from app.services.request_policy import require_paid
from sqlalchemy.exc import IntegrityError
from decimal import Decimal
from app.services.file_service import FileService
from app.services.notification_service import NotificationService
from app.services.document_service import DocumentGenerationService

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
    try:
        compte_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise exc
    compte = db.query(CompteCitoyen).filter(
        CompteCitoyen.id == compte_id,
        CompteCitoyen.is_active == True
    ).first()
    import hmac
    if not compte or not hmac.compare_digest(str(payload.get("pwd", "")), password_session_stamp(compte.hashed_password)):
        raise exc
    return compte


# ══════════════════════════════════════════════════════════════════
#  Schémas Pydantic inline
# ══════════════════════════════════════════════════════════════════
class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8, max_length=256)
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
    reference_paiement: str = Field(..., min_length=1, max_length=100)
    methode: str = "MVola"

class ProfilUpdate(BaseModel):
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    fokontany_id: Optional[int] = None

class ChangePasswordRequest(BaseModel):
    ancien_password: str = Field(..., min_length=1)
    nouveau_password: str = Field(..., min_length=8, max_length=256)
    confirmer_password: str = Field(..., min_length=8, max_length=256)


# ══════════════════════════════════════════════════════════════════
#  INSCRIPTION
# ══════════════════════════════════════════════════════════════════
@router.post("/inscription", status_code=201, summary="Inscription d'un nouveau citoyen")
def inscription(body: RegisterRequest, db: Session = Depends(get_db)):
    # Email unique
    if db.query(CompteCitoyen).filter(CompteCitoyen.email == body.email.strip().lower()).first():
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
        email=body.email.strip().lower(),
        hashed_password=hash_password(body.password),
        citoyen_id=citoyen.id,
        is_verified=True,   # Vérification email optionnelle en prod
    )
    db.add(compte)
    db.commit()
    db.refresh(compte)

    token = create_access_token({"sub": str(compte.id), "type": "citoyen", "pwd": password_session_stamp(compte.hashed_password)})
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

    token = create_access_token({"sub": str(compte.id), "type": "citoyen", "pwd": password_session_stamp(compte.hashed_password)})
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
    svc = db.query(CatalogueService).filter(CatalogueService.code == body.service_code, CatalogueService.is_active == True).first()
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

    uploads = []
    for piece in body.pieces_jointes or []:
        upload = db.query(FichierCitoyen).filter(
            FichierCitoyen.compte_id == compte.id,
            FichierCitoyen.url_fichier == piece.get("url"),
            FichierCitoyen.demande_id.is_(None),
        ).first()
        if upload:
            uploads.append(upload)
            continue
        source = db.query(DemandeService).filter(
            DemandeService.compte_id == compte.id,
            DemandeService.document_final == piece.get("url"),
            DemandeService.statut.in_(["Approuvée", "Prête"]),
        ).first() if piece.get("url") else None
        if not source:
            raise HTTPException(422, "Pièce jointe inexistante ou non autorisée")

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
    db.flush()
    db.add(EvenementDemande(
        demande_id=demande.id, type_event="SOUMISSION", nouveau_statut="Soumise",
    ))
    for upload in uploads:
        upload.demande_id = demande.id
    db.commit()
    db.refresh(demande)
    
    # Créer une notification de création
    try:
        NotificationService.create_notification(
            db=db,
            compte_citoyen=compte,
            type_notif="CREATION",
            demande=demande,
            service=svc.nom,
            reference=demande.reference,
            via_email=False,
            via_sms=False,
            via_push=False,
        )
    except Exception as e:
        # Log l'erreur mais ne pas échouer la soumission
        print(f"Erreur lors de la création de la notification: {e}")
    
    return {
        "reference": demande.reference,
        "statut": demande.statut,
        "montant_ar": demande.montant_ar,
        "message": "Demande soumise avec succès. Le suivi est disponible dans votre espace citoyen."
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
    ).with_for_update().first()
    if not d:
        raise HTTPException(404, "Demande introuvable")
    if d.statut == "Rejetée":
        raise HTTPException(409, "Une demande rejetée ne peut pas être payée")
    if d.montant_ar <= 0:
        raise HTTPException(409, "Cette demande est gratuite")
    demo = body.reference_paiement == "DEMO"
    if demo:
        if not get_settings().payment_demo_enabled:
            raise HTTPException(403, "Paiement démo désactivé")
        txn = db.query(Transaction).filter(Transaction.idempotency_key == f"demo:{d.id}").first()
        if not txn:
            from app.services.ref_service import gen_reference
            txn = Transaction(
                reference=gen_reference("TXN"), citoyen_id=compte.citoyen_id,
                type_paiement="Démo", montant=d.montant_ar, statut="Confirmé",
                idempotency_key=f"demo:{d.id}", reference_externe=f"DEMO:{d.id}",
            )
            db.add(txn)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                raise HTTPException(409, "Simulation concurrente : rechargez la demande puis réessayez")
        payment_reference = txn.reference
    else:
        payment_reference = body.reference_paiement
    txn = db.query(Transaction).filter(
        Transaction.reference == payment_reference,
        Transaction.citoyen_id == compte.citoyen_id,
        Transaction.statut == "Confirmé",
    ).with_for_update().first()
    if not txn or Decimal(str(txn.montant)) != Decimal(str(d.montant_ar)):
        raise HTTPException(409, "Aucun encaissement confirmé correspondant au citoyen et au montant")
    demo = txn.type_paiement == "Démo"
    if demo and not get_settings().payment_demo_enabled:
        raise HTTPException(403, "Paiement démo désactivé")
    existing = db.query(PaiementDemande).filter(PaiementDemande.demande_id == d.id).first()
    if existing:
        if existing.transaction_id != txn.id:
            raise HTTPException(409, "Demande déjà réglée avec une autre transaction")
        return {"message": "Paiement déjà rapproché", "reference": d.reference, "demo": txn.type_paiement == "Démo"}
    if db.get(PaiementDemande, txn.id):
        raise HTTPException(409, "Transaction déjà affectée à une demande")
    try:
        db.add(PaiementDemande(transaction_id=txn.id, demande_id=d.id))
        d.statut_paiement = "Payé"
        d.reference_paiement = txn.reference
        db.add(EvenementDemande(demande_id=d.id, type_event="PAIEMENT",
                               description=f"{'Simulation démo' if demo else 'Encaissement rapproché'} : {txn.reference}"))
        NotificationService.create_notification(
            db, compte, "PAIEMENT", demande=d, montant=d.montant_ar,
            via_email=False, via_sms=False, commit=False,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Transaction ou demande déjà rapprochée, rechargez le dossier")
    return {"message": "Paiement simulé — aucun débit réel" if demo else "Paiement vérifié dans le registre des encaissements", "reference": d.reference, "demo": demo}


# ══════════════════════════════════════════════════════════════════
#  FOKONTANY (pour le formulaire d'inscription)
# ══════════════════════════════════════════════════════════════════
@router.get("/fokontany", summary="Liste des fokontany")
def list_fokontany(db: Session = Depends(get_db)):
    return db.query(Fokontany).filter(Fokontany.is_online == True).all()


# ══════════════════════════════════════════════════════════════════
#  UPLOADS DE FICHIERS
# ══════════════════════════════════════════════════════════════════
@router.post("/upload", status_code=201, summary="Télécharger un fichier")
async def upload_file(
    file: UploadFile = File(...),
    demande_id: str = Form(...),
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """
    Télécharge un fichier (document, justificatif, pièce jointe).
    Valide le type MIME et la taille.
    """
    linked_demande = db.query(DemandeService).filter(DemandeService.id == demande_id).first()
    if linked_demande and linked_demande.compte_id != compte.id:
        raise HTTPException(404, "Demande introuvable")
    # A client-generated draft ID is only a staging label, never a filesystem path.
    storage_id = str(uuid.uuid4())
    try:
        # Lire le contenu du fichier
        contents = await file.read(10 * 1024 * 1024 + 1)
        
        # Valider le fichier
        FileService.validate_file(file.filename, len(contents), file.content_type)
        
        # Sauvegarder le fichier
        file_url, sha256 = FileService.save_upload(
            file_content=contents,
            original_filename=file.filename,
            demande_id=storage_id,
            user_id=compte.id
        )
        
        # Créer un enregistrement FichierCitoyen
        piece = FichierCitoyen(
            demande_id=linked_demande.id if linked_demande else None,
            compte_id=compte.id,
            nom_fichier=file.filename,
            type_code=file.content_type,
            url_fichier=file_url,
            mime_type=file.content_type,
            taille_bytes=len(contents),
            hash_sha256=sha256,
            obtenu_ici=False,
        )
        db.add(piece)
        db.commit()
        db.refresh(piece)
        
        return {
            "id": piece.id,
            "nom": piece.nom_fichier,
            "url": file_url,
            "type": file.content_type,
            "taille": FileService.format_file_size(len(contents)),
            "hash": sha256,
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Erreur lors du téléchargement: {str(e)}")


@router.delete("/upload/{piece_id}", summary="Supprimer un fichier téléchargé")
def delete_upload(
    piece_id: str,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """Supprime un fichier téléchargé (avant soumission)."""
    piece = db.query(FichierCitoyen).filter(
        FichierCitoyen.id == piece_id,
        FichierCitoyen.compte_id == compte.id,
    ).first()
    if not piece:
        raise HTTPException(404, "Fichier introuvable")
    
    if piece.demande_id:
        raise HTTPException(409, "Cette pièce est liée à une demande soumise")

    # Supprimer du disque
    try:
        FileService.delete_file(piece.url_fichier)
    except Exception:
        pass  # Ignorer si le fichier physique n'existe pas
    
    # Supprimer de la BD
    db.delete(piece)
    db.commit()
    return {"message": "Fichier supprimé"}


# ══════════════════════════════════════════════════════════════════
#  TÉLÉCHARGER UN FICHIER (GET)
# ══════════════════════════════════════════════════════════════════
@router.get("/fichier/{piece_id}", summary="Télécharger un fichier")
def get_file(
    piece_id: str,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """Récupère le chemin d'un fichier (pour téléchargement côté client)."""
    piece = db.query(FichierCitoyen).filter(
        FichierCitoyen.id == piece_id,
        FichierCitoyen.compte_id == compte.id,
    ).first()
    if not piece:
        raise HTTPException(404, "Fichier introuvable")
    
    file_path = FileService.get_file_path(piece.url_fichier)
    if not file_path:
        raise HTTPException(404, "Fichier introuvable sur le serveur")
    return FileResponse(
        path=file_path,
        media_type=piece.mime_type or "application/octet-stream",
        filename=piece.nom_fichier,
    )


# ══════════════════════════════════════════════════════════════════
#  NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════
@router.get("/notifications", summary="Mes notifications")
def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """Récupère les notifications du citoyen."""
    notifs = NotificationService.get_notifications(
        db=db,
        compte_id=compte.id,
        limit=limit,
        unread_only=unread_only,
    )
    return [
        {
            "id": n.id,
            "type": n.type_notif,
            "titre": n.titre,
            "message": n.message,
            "via_email": n.via_email,
            "via_sms": n.via_sms,
            "via_push": n.via_push,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifs
    ]


@router.patch("/notifications/{notif_id}/lire", summary="Marquer une notification comme lue")
def mark_notification_read(
    notif_id: str,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """Marque une notification comme lue."""
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.compte_id == compte.id,
    ).first()
    if not notif:
        raise HTTPException(404, "Notification introuvable")
    
    NotificationService.mark_as_read(db, notif.id)
    return {"message": "Notification marquée comme lue"}


@router.patch("/notifications/tout-marquer-lu", summary="Marquer toutes les notifications comme lues")
def mark_all_notifications_read(
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """Marque toutes les notifications comme lues."""
    count = NotificationService.mark_all_as_read(db, compte.id)
    return {"message": f"{count} notification(s) marquée(s) comme lue(s)"}


@router.delete("/notifications/{notif_id}", summary="Supprimer une notification")
def delete_notification(
    notif_id: str,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """Supprime une notification."""
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.compte_id == compte.id,
    ).first()
    if not notif:
        raise HTTPException(404, "Notification introuvable")
    
    NotificationService.delete_notification(db, notif.id)
    return {"message": "Notification supprimée"}


# ══════════════════════════════════════════════════════════════════
#  DOCUMENTS FINALISÉS
# ══════════════════════════════════════════════════════════════════
@router.get("/demandes/{demande_id}/document", summary="Télécharger le document finalisé")
def get_document(
    demande_id: str,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """Récupère le document finalisé pour une demande."""
    d = db.query(DemandeService).filter(
        DemandeService.id == demande_id,
        DemandeService.compte_id == compte.id,
    ).first()
    if not d:
        raise HTTPException(404, "Demande introuvable")
    
    require_paid(d)
    if d.statut not in ["Approuvée", "Prête"]:
        raise HTTPException(409, "Demande non approuvée")
    if not d.document_final:
        raise HTTPException(404, "Document non disponible pour cette demande")
    
    doc = db.query(DocumentFinal).filter(DocumentFinal.demande_id == demande_id).first()
    if not doc:
        raise HTTPException(404, "Document introuvable")
    
    # Vérifier l'expiration
    if not DocumentGenerationService.is_document_valid(doc):
        raise HTTPException(410, "Document a expiré (validité 30 jours)")
    
    file_path = DocumentGenerationService.get_document_file(doc.url_telechargement)
    if not file_path:
        raise HTTPException(404, "Document introuvable sur le serveur")
    return FileResponse(
        path=file_path,
        media_type="text/html",
        filename=doc.nom_fichier,
    )


@router.post("/demandes/{demande_id}/generer-document", status_code=201, summary="Générer le document finalisé")
def generate_document(
    demande_id: str,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """Génère le document finalisé pour une demande (après approbation)."""
    d = db.query(DemandeService).filter(
        DemandeService.id == demande_id,
        DemandeService.compte_id == compte.id,
    ).first()
    if not d:
        raise HTTPException(404, "Demande introuvable")
    
    if d.statut not in ["Approuvée", "Prête"]:
        raise HTTPException(
            400,
            f"Document ne peut être généré que pour les demandes approuvées (statut actuel: {d.statut})"
        )
    
    require_paid(d)
    try:
        # Générer et sauvegarder le document
        doc = DocumentGenerationService.create_or_update_document(
            db=db,
            demande=d,
            agent_id=None,
        )
        
        if doc is None:
            raise RuntimeError("Échec du stockage du document")
        return {
            "id": doc.id,
            "url": doc.url_telechargement,
            "created_at": doc.created_at.isoformat(),
            "expires_at": doc.expires_at.isoformat() if doc.expires_at else None,
            "message": "Document généré avec succès",
        }
    except Exception as e:
        raise HTTPException(500, f"Erreur lors de la génération du document: {str(e)}")


# ══════════════════════════════════════════════════════════════════
#  GESTION DU MOT DE PASSE
# ══════════════════════════════════════════════════════════════════
@router.post("/change-password", summary="Changer mon mot de passe")
def change_password(
    body: ChangePasswordRequest,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    """Change le mot de passe du citoyen."""
    # Vérifier l'ancien mot de passe
    if not verify_password(body.ancien_password, compte.hashed_password):
        raise HTTPException(401, "Ancien mot de passe incorrect")
    
    # Vérifier que les deux nouveaux mots de passe correspondent
    if body.nouveau_password != body.confirmer_password:
        raise HTTPException(400, "Les nouveaux mots de passe ne correspondent pas")
    
    # Vérifier qu'il n'est pas identique à l'ancien
    if body.nouveau_password == body.ancien_password:
        raise HTTPException(400, "Le nouveau mot de passe doit être différent de l'ancien")
    
    # Mettre à jour le mot de passe
    compte.hashed_password = hash_password(body.nouveau_password)
    from app.services.password_recovery import invalidate_resets
    invalidate_resets(db, compte.id)
    db.commit()
    
    return {"message": "Mot de passe changé avec succès"}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/forgot-password", status_code=202, summary="Demander une réinitialisation")
def forgot_password(body: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    from app.services.password_recovery import request_reset
    request_reset(db, str(body.email).strip().lower(), request.client.host if request.client else "unknown")
    return {"message": "Si un compte actif correspond, un lien de réinitialisation vous sera envoyé."}


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=32, max_length=256)
    nouveau_password: str = Field(..., min_length=8, max_length=256)
    confirmer_password: str = Field(..., min_length=8, max_length=256)


@router.post("/reset-password", summary="Réinitialiser le mot de passe")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if body.nouveau_password != body.confirmer_password:
        raise HTTPException(400, "Les mots de passe ne correspondent pas")
    from app.services.password_recovery import consume_reset
    consume_reset(db, body.token, body.nouveau_password)
    return {"message": "Mot de passe réinitialisé. Reconnectez-vous avec votre nouveau mot de passe."}


@router.get("/demandes/{demande_id}/historique", summary="Historique de ma demande")
def historique_demande(
    demande_id: str,
    compte: CompteCitoyen = Depends(get_current_citoyen),
    db: Session = Depends(get_db),
):
    demande = db.query(DemandeService).filter(
        DemandeService.id == demande_id, DemandeService.compte_id == compte.id,
    ).first()
    if not demande:
        raise HTTPException(404, "Demande introuvable")
    return db.query(EvenementDemande).filter(
        EvenementDemande.demande_id == demande_id,
    ).order_by(EvenementDemande.timestamp, EvenementDemande.id).all()


@router.get("/paiement/config", summary="Mode de paiement disponible")
def paiement_config():
    return {"demo_enabled": get_settings().payment_demo_enabled}
