# backend/app/views.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from passlib.context import CryptContext
from .database import get_db
from . import models, schemas

router = APIRouter()
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# --- DONNÉES INTERNES (Papiers Administratifs) ---
# Ces données sont gérées en interne pour éviter les erreurs de base de données.
LISTE_PAPIERS = [
    {"id": "certificat_residence", "name": "Certificat de résidence", "price": 1000.0, "category": "Général"},
    {"id": "acte_naissance", "name": "Copie d'acte de naissance", "price": 2000.0, "category": "État Civil"},
    {"id": "certificat_celibat", "name": "Certificat de célibat", "price": 1500.0, "category": "Général"},
    {"id": "legalisation", "name": "Légalisation de signature", "price": 500.0, "category": "Juridique"}
]

# --- AUTHENTIFICATION ---
@router.post("/login")
def login(user_data: dict, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user_data.get("username")).first()
    if not db_user or not pwd_context.verify(user_data.get("password"), db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    return {"message": "Connexion réussie", "role": "admin"}

# --- CITOYENS (Dynamique - PostgreSQL) ---
@router.get("/citizens/", response_model=list[schemas.Citizen])
def get_citizens(db: Session = Depends(get_db)):
    return db.query(models.Citizen).all()

@router.post("/citizens/", response_model=schemas.Citizen, status_code=status.HTTP_201_CREATED)
def create_citizen(citizen: schemas.CitizenCreate, db: Session = Depends(get_db)):
    try:
        db_citizen = models.Citizen(**citizen.model_dump())
        db.add(db_citizen)
        db.commit()
        db.refresh(db_citizen)
        return db_citizen
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/citizens/{citizen_id}")
def delete_citizen(citizen_id: UUID, db: Session = Depends(get_db)):
    db_citizen = db.query(models.Citizen).filter(models.Citizen.id == citizen_id).first()
    if not db_citizen:
        raise HTTPException(status_code=404, detail="Citoyen non trouvé")
    db.delete(db_citizen)
    db.commit()
    return {"message": "Suppression réussie"}

# --- PAPIERS ADMINISTRATIFS (Interne) ---
@router.get("/papers/", response_model=list[schemas.Paper])
def get_papers():
    """Retourne la liste statique des tarifs de la commune."""
    return LISTE_PAPIERS

# Note : Les routes POST et PATCH pour les papiers ont été retirées 
# car la gestion est désormais interne pour plus de stabilité.