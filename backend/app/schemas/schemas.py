"""
CommuneDigit — Schémas Pydantic
Validation stricte des données entrantes et sortantes
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator
import re


# ════════════════════════════════════════
#  AUTH
# ════════════════════════════════════════
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=4)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ════════════════════════════════════════
#  AGENT
# ════════════════════════════════════════
class AgentCreate(BaseModel):
    nom:       str = Field(..., min_length=1, max_length=100)
    prenom:    str = Field(..., min_length=1, max_length=200)
    role:      str = Field(default="Agent Fokontany")
    fokontany: str = Field(..., min_length=1)
    telephone: Optional[str] = None
    email:     Optional[str] = None
    password:  str = Field(..., min_length=6)

class AgentUpdate(BaseModel):
    nom:       Optional[str] = None
    prenom:    Optional[str] = None
    role:      Optional[str] = None
    fokontany: Optional[str] = None
    telephone: Optional[str] = None
    email:     Optional[str] = None
    is_active: Optional[bool] = None

class AgentOut(BaseModel):
    id:        int
    matricule: str
    nom:       str
    prenom:    str
    role:      str
    fokontany: str
    telephone: Optional[str]
    email:     Optional[str]
    is_active: bool
    created_at:datetime
    last_login:Optional[datetime]

    class Config:
        from_attributes = True


# ════════════════════════════════════════
#  FOKONTANY
# ════════════════════════════════════════
class FokontanyCreate(BaseModel):
    nom:       str
    commune:   str
    latitude:  Optional[float] = None
    longitude: Optional[float] = None
    population:Optional[int] = 0

class FokontanyOut(BaseModel):
    id:        int
    nom:       str
    commune:   str
    latitude:  Optional[float]
    longitude: Optional[float]
    population:int
    is_online: bool

    class Config:
        from_attributes = True


# ════════════════════════════════════════
#  CITOYEN
# ════════════════════════════════════════
class CitoySBase(BaseModel):
    nom:          str = Field(..., min_length=1, max_length=100)
    prenom:       str = Field(..., min_length=1, max_length=200)
    cin:          Optional[str] = None
    telephone:    str = Field(..., min_length=8)
    adresse:      Optional[str] = None
    fokontany_id: Optional[int] = None

class CitoyenCreate(CitoySBase):
    pass

class CitoyenUpdate(BaseModel):
    nom:          Optional[str] = None
    prenom:       Optional[str] = None
    cin:          Optional[str] = None
    telephone:    Optional[str] = None
    adresse:      Optional[str] = None
    fokontany_id: Optional[int] = None
    is_active:    Optional[bool] = None

class CitoyenOut(CitoySBase):
    id:         str
    is_active:  bool
    last_update:datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════
#  ACTE ÉTAT CIVIL
# ════════════════════════════════════════
class ActeCreate(BaseModel):
    type_acte:       str = Field(..., pattern="^(Naissance|Mariage|Décès)$")
    nom_concerne:    str = Field(..., min_length=1)
    date_evenement:  datetime
    lieu_evenement:  Optional[str] = None
    details_json:    Optional[str] = None   # JSON stringifié
    citoyen_id:      Optional[str] = None
    fokontany_id:    Optional[int] = None

class ActeUpdate(BaseModel):
    statut:          Optional[str] = None
    nom_concerne:    Optional[str] = None
    date_evenement:  Optional[datetime] = None
    lieu_evenement:  Optional[str] = None
    details_json:    Optional[str] = None
    is_validated:    Optional[bool] = None

class ActeOut(BaseModel):
    id:              str
    reference:       str
    type_acte:       str
    nom_concerne:    str
    date_evenement:  datetime
    lieu_evenement:  Optional[str]
    statut:          str
    hash_sha256:     Optional[str]
    is_validated:    bool
    agent_id:        Optional[int]
    created_at:      datetime
    updated_at:      datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════
#  CERTIFICAT
# ════════════════════════════════════════
class CertificatCreate(BaseModel):
    type_cert:  str = Field(..., pattern="^(Résidence|Héritage|Permis|Autre)$")
    citoyen_id: Optional[str] = None
    motif:      Optional[str] = None
    prix:       float = 0

class CertificatUpdate(BaseModel):
    statut:     Optional[str] = None
    motif:      Optional[str] = None
    prix:       Optional[float] = None

class CertificatOut(BaseModel):
    id:         str
    reference:  str
    type_cert:  str
    motif:      Optional[str]
    statut:     str
    prix:       float
    created_at: datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════
#  TRANSACTION / PAIEMENT
# ════════════════════════════════════════
class TransactionCreate(BaseModel):
    citoyen_id:        Optional[str] = None
    type_paiement:     str = Field(..., min_length=1)
    montant:           float = Field(..., gt=0)
    idempotency_key:   str = Field(..., min_length=10)
    reference_externe: Optional[str] = None

class TransactionOut(BaseModel):
    id:               str
    reference:        str
    type_paiement:    str
    montant:          float
    statut:           str
    idempotency_key:  str
    created_at:       datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════
#  ALERTE
# ════════════════════════════════════════
class AlerteCreate(BaseModel):
    type_alerte:   str = Field(..., pattern="^(Santé|Sécurité|Admin|Infos)$")
    urgence:       str = Field(default="Normale", pattern="^(Haute|Normale)$")
    titre:         str = Field(..., min_length=3)
    corps:         str = Field(..., min_length=10)
    destinataires: Optional[str] = "Tous les Fokontany"

class AlerteOut(BaseModel):
    id:            int
    type_alerte:   str
    urgence:       str
    titre:         str
    corps:         str
    destinataires: str
    statut:        str
    created_at:    datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════
#  AUDIT LOG
# ════════════════════════════════════════
class AuditLogOut(BaseModel):
    id:            int
    action:        str
    entite:        str
    entite_id:     Optional[str]
    detail:        Optional[str]
    agent_id:      Optional[int]
    ip_address:    Optional[str]
    niveau_risque: str
    hash_sha256:   Optional[str]
    timestamp:     datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════
#  DEMANDE PUBLIQUE
# ════════════════════════════════════════
class DemandeCreate(BaseModel):
    nom:         str = Field(..., min_length=1)
    prenom:      str = Field(..., min_length=1)
    cin:         Optional[str] = None
    telephone:   str = Field(..., min_length=8)
    fokontany:   str = Field(..., min_length=1)
    service:     str = Field(..., min_length=1)
    description: Optional[str] = None

class DemandeOut(BaseModel):
    id:         int
    reference:  str
    nom:        str
    prenom:     str
    service:    str
    statut:     str
    created_at: datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════
#  DASHBOARD STATS
# ════════════════════════════════════════
class DashboardStats(BaseModel):
    total_citoyens:      int
    actes_ce_mois:       int
    dossiers_en_attente: int
    taxes_collectees:    float
    agents_actifs:       int
    fokontany_connectes: int
    alertes_actives:     int


# ════════════════════════════════════════
#  SYNC (offline-first)
# ════════════════════════════════════════
class SyncRecord(BaseModel):
    entity_type: str          # "acte", "citoyen", "transaction"
    entity_id:   str
    data:        dict
    timestamp:   str          # ISO8601
    hash:        str          # SHA-256 pour intégrité
    client_id:   str          # ID appareil mobile

class SyncRequest(BaseModel):
    records: List[SyncRecord]

class SyncResponse(BaseModel):
    accepted: List[str]       # IDs acceptés
    conflicts: List[str]      # IDs en conflit (LWW résolu)
    errors: List[str]         # IDs rejetés
