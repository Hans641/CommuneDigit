"""
CommuneDigit — Modèles SQLAlchemy
Inclut maintenant CompteCitoyen + DemandeService pour l'espace citoyen
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship

from app.core.config import Base


def new_uuid():
    return str(uuid.uuid4())


# ── Agent (inchangé) ──────────────────────────────────────────────
class Agent(Base):
    __tablename__ = "agents"

    id              = Column(Integer, primary_key=True, index=True)
    matricule       = Column(String(20), unique=True, index=True, nullable=False)
    nom             = Column(String(100), nullable=False)
    prenom          = Column(String(100), nullable=False)
    role            = Column(
        SAEnum("Agent Fokontany", "Superviseur", "Administrateur", "Ministère MID", name="role_enum"),
        nullable=False, default="Agent Fokontany"
    )
    fokontany       = Column(String(200), nullable=False)
    telephone       = Column(String(20))
    email           = Column(String(200))
    hashed_password = Column(String(200), nullable=False)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    last_login      = Column(DateTime, nullable=True)

    actes        = relationship("ActeEtatCivil", back_populates="agent")
    audit_logs   = relationship("AuditLog", back_populates="agent")
    certificats  = relationship("Certificat", back_populates="agent")
    transactions = relationship("Transaction", back_populates="agent")
    demandes     = relationship("DemandeService", back_populates="agent_traitement")


# ── Fokontany (inchangé) ──────────────────────────────────────────
class Fokontany(Base):
    __tablename__ = "fokontany"

    id         = Column(Integer, primary_key=True, index=True)
    nom        = Column(String(200), nullable=False, index=True)
    commune    = Column(String(200), nullable=False)
    latitude   = Column(Float, nullable=True)
    longitude  = Column(Float, nullable=True)
    population = Column(Integer, default=0)
    is_online  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    citoyens = relationship("Citoyen", back_populates="fokontany_rel")
    actes    = relationship("ActeEtatCivil", back_populates="fokontany_rel")


# ── Citoyen (fiche administrative — sans auth) ────────────────────
class Citoyen(Base):
    __tablename__ = "citoyens"

    id           = Column(String(36), primary_key=True, default=new_uuid, index=True)
    nom          = Column(String(100), nullable=False, index=True)
    prenom       = Column(String(200), nullable=False)
    cin          = Column(String(30), unique=True, nullable=True, index=True)
    telephone    = Column(String(20), nullable=False)
    adresse      = Column(Text, nullable=True)
    fokontany_id = Column(Integer, ForeignKey("fokontany.id"), nullable=True)
    is_active    = Column(Boolean, default=True)
    last_update  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at   = Column(DateTime, default=datetime.utcnow)

    fokontany_rel = relationship("Fokontany", back_populates="citoyens")
    actes         = relationship("ActeEtatCivil", back_populates="citoyen")
    transactions  = relationship("Transaction", back_populates="citoyen")
    certificats   = relationship("Certificat", back_populates="citoyen")
    compte        = relationship("CompteCitoyen", back_populates="citoyen", uselist=False)
    demandes      = relationship("DemandeService", back_populates="citoyen")


# ── CompteCitoyen — auth séparée des agents ───────────────────────
class CompteCitoyen(Base):
    """
    Compte numérique d'un citoyen (email + mot de passe).
    Lié à sa fiche Citoyen par citoyen_id.
    Distinct du modèle Agent qui gère les agents de la commune.
    """
    __tablename__ = "comptes_citoyens"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    citoyen_id      = Column(String(36), ForeignKey("citoyens.id"), nullable=True)
    is_verified     = Column(Boolean, default=False)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    last_login      = Column(DateTime, nullable=True)

    citoyen = relationship("Citoyen", back_populates="compte")


# ── ProjetCommune — projets affichés aux citoyens ─────────────────
class ProjetCommune(Base):
    """Projets communaux visibles dans l'espace citoyen."""
    __tablename__ = "projets_commune"

    id          = Column(Integer, primary_key=True, index=True)
    titre       = Column(String(300), nullable=False)
    description = Column(Text, nullable=False)
    categorie   = Column(String(100), nullable=False, default="Infrastructure")
    statut      = Column(
        SAEnum("En cours", "Planifié", "Terminé", name="statut_projet_enum"),
        default="Planifié"
    )
    budget_ar   = Column(Float, nullable=True)
    debut_prevu = Column(DateTime, nullable=True)
    fin_prevue  = Column(DateTime, nullable=True)
    fokontany   = Column(String(200), nullable=True)
    image_url   = Column(String(500), nullable=True)
    is_visible  = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)


# ── CatalogueService — catalogue des documents administratifs ─────
class CatalogueService(Base):
    """
    Catalogue de tous les documents/services disponibles.
    Chaque service définit:
    - son prix
    - la liste des documents requis (JSON list de type_service)
    - si ces documents peuvent être obtenus sur la plateforme
    """
    __tablename__ = "catalogue_services"

    id               = Column(Integer, primary_key=True, index=True)
    code             = Column(String(50), unique=True, nullable=False, index=True)
    nom              = Column(String(300), nullable=False)
    nom_mg           = Column(String(300), nullable=True)
    description      = Column(Text, nullable=True)
    description_mg   = Column(Text, nullable=True)
    categorie        = Column(String(100), nullable=False)  # "Etat civil", "Certificat", "Taxe"
    prix_ar          = Column(Float, default=0)
    delai_jours      = Column(Integer, default=3)
    documents_requis = Column(JSON, nullable=True)
    # ex: [{"code": "CERT_RESIDENCE", "label": "Certificat de résidence", "obtainable_here": true}]
    is_active        = Column(Boolean, default=True)
    icone            = Column(String(10), default="📄")
    created_at       = Column(DateTime, default=datetime.utcnow)

    demandes = relationship("DemandeService", back_populates="service")


# ── DemandeService — demande d'un citoyen ─────────────────────────
class DemandeService(Base):
    """
    Demande soumise par un citoyen connecté.
    Gère les pièces jointes, le paiement et le statut du traitement.
    Le champ pieces_jointes_json stocke les URLs/noms des fichiers uploadés.
    """
    __tablename__ = "demandes_service"

    id               = Column(String(36), primary_key=True, default=new_uuid)
    reference        = Column(String(30), unique=True, nullable=False, index=True)
    compte_id        = Column(Integer, ForeignKey("comptes_citoyens.id"), nullable=False)
    citoyen_id       = Column(String(36), ForeignKey("citoyens.id"), nullable=True)
    service_code     = Column(String(50), ForeignKey("catalogue_services.code"), nullable=False)

    # Données saisies par le citoyen
    donnees_json     = Column(JSON, nullable=True)    # champs spécifiques au service
    pieces_jointes   = Column(JSON, nullable=True)    # [{nom, url, type, obtenu_ici}]

    # Paiement
    montant_ar       = Column(Float, default=0)
    statut_paiement  = Column(
        SAEnum("En attente", "Payé", "Remboursé", name="statut_paiement_citoyen_enum"),
        default="En attente"
    )
    reference_paiement = Column(String(100), nullable=True)

    # Traitement
    statut           = Column(
        SAEnum(
            "Brouillon", "Soumise", "En traitement", "Approuvée", "Rejetée", "Prête",
            name="statut_demande_enum"
        ),
        default="Brouillon"
    )
    note_agent       = Column(Text, nullable=True)
    document_final   = Column(String(500), nullable=True)  # URL du document délivré
    agent_id         = Column(Integer, ForeignKey("agents.id"), nullable=True)

    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    soumise_at       = Column(DateTime, nullable=True)

    # Relations
    compte           = relationship("CompteCitoyen")
    citoyen          = relationship("Citoyen", back_populates="demandes")
    service          = relationship("CatalogueService", back_populates="demandes")
    agent_traitement = relationship("Agent", back_populates="demandes")


# ── Modèles inchangés ─────────────────────────────────────────────
class ActeEtatCivil(Base):
    __tablename__ = "actes_etat_civil"

    id              = Column(String(36), primary_key=True, default=new_uuid)
    reference       = Column(String(20), unique=True, nullable=False, index=True)
    type_acte       = Column(
        SAEnum("Naissance", "Mariage", "Décès", name="type_acte_enum"), nullable=False
    )
    nom_concerne    = Column(String(300), nullable=False)
    date_evenement  = Column(DateTime, nullable=False)
    lieu_evenement  = Column(String(300), nullable=True)
    details_json    = Column(Text, nullable=True)
    statut          = Column(
        SAEnum("En attente", "En cours", "Validé", "Rejeté", name="statut_acte_enum"),
        default="En attente"
    )
    hash_sha256     = Column(String(64), nullable=True)
    is_validated    = Column(Boolean, default=False)
    citoyen_id      = Column(String(36), ForeignKey("citoyens.id"), nullable=True)
    fokontany_id    = Column(Integer, ForeignKey("fokontany.id"), nullable=True)
    agent_id        = Column(Integer, ForeignKey("agents.id"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_update     = Column(DateTime, default=datetime.utcnow)

    citoyen       = relationship("Citoyen", back_populates="actes")
    fokontany_rel = relationship("Fokontany", back_populates="actes")
    agent         = relationship("Agent", back_populates="actes")


class Certificat(Base):
    __tablename__ = "certificats"

    id         = Column(String(36), primary_key=True, default=new_uuid)
    reference  = Column(String(20), unique=True, nullable=False, index=True)
    type_cert  = Column(
        SAEnum("Résidence", "Héritage", "Permis", "Autre", name="type_cert_enum"),
        nullable=False
    )
    citoyen_id = Column(String(36), ForeignKey("citoyens.id"), nullable=True)
    motif      = Column(Text, nullable=True)
    statut     = Column(
        SAEnum("En attente", "En cours", "Délivré", "Rejeté", name="statut_cert_enum"),
        default="En attente"
    )
    prix       = Column(Float, default=0)
    agent_id   = Column(Integer, ForeignKey("agents.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    citoyen = relationship("Citoyen", back_populates="certificats")
    agent   = relationship("Agent", back_populates="certificats")


class Transaction(Base):
    __tablename__ = "transactions"

    id                = Column(String(36), primary_key=True, default=new_uuid)
    reference         = Column(String(20), unique=True, nullable=False, index=True)
    citoyen_id        = Column(String(36), ForeignKey("citoyens.id"), nullable=True)
    agent_id          = Column(Integer, ForeignKey("agents.id"), nullable=True)
    type_paiement     = Column(String(100), nullable=False)
    montant           = Column(Float, nullable=False)
    statut            = Column(
        SAEnum("En attente", "Confirmé", "Annulé", "Remboursé", name="statut_txn_enum"),
        default="En attente"
    )
    idempotency_key   = Column(String(64), unique=True, nullable=False, index=True)
    reference_externe = Column(String(200), nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    citoyen = relationship("Citoyen", back_populates="transactions")
    agent   = relationship("Agent", back_populates="transactions")


class Alerte(Base):
    __tablename__ = "alertes"

    id           = Column(Integer, primary_key=True, index=True)
    type_alerte  = Column(SAEnum("Santé", "Sécurité", "Admin", "Infos", name="type_alerte_enum"), nullable=False)
    urgence      = Column(SAEnum("Haute", "Normale", name="urgence_enum"), default="Normale")
    titre        = Column(String(300), nullable=False)
    corps        = Column(Text, nullable=False)
    destinataires= Column(String(200), default="Tous les Fokontany")
    statut       = Column(SAEnum("Active", "Planifiée", "Expirée", name="statut_alerte_enum"), default="Active")
    created_by   = Column(Integer, ForeignKey("agents.id"), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    expires_at   = Column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id            = Column(Integer, primary_key=True, index=True)
    action        = Column(String(20), nullable=False)
    entite        = Column(String(50), nullable=False)
    entite_id     = Column(String(36), nullable=True)
    detail        = Column(Text, nullable=True)
    agent_id      = Column(Integer, ForeignKey("agents.id"), nullable=True)
    ip_address    = Column(String(50), nullable=True)
    niveau_risque = Column(SAEnum("Faible", "Moyen", "Élevé", name="risque_enum"), default="Faible")
    hash_sha256   = Column(String(64), nullable=True)
    timestamp     = Column(DateTime, default=datetime.utcnow, index=True)

    agent = relationship("Agent", back_populates="audit_logs")


class DemandePub(Base):
    __tablename__ = "demandes_pub"

    id          = Column(Integer, primary_key=True, index=True)
    reference   = Column(String(20), unique=True, nullable=False, index=True)
    nom         = Column(String(100), nullable=False)
    prenom      = Column(String(200), nullable=False)
    cin         = Column(String(30), nullable=True)
    telephone   = Column(String(20), nullable=False)
    fokontany   = Column(String(200), nullable=False)
    service     = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    statut      = Column(String(50), default="Reçue")
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
