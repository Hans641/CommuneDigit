# backend/init_db.py
from app.database import SessionLocal
from app import models
from passlib.context import CryptContext
import sys

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def init_admin():
    db = SessionLocal()
    try:
        print("Vérification de la base de données...")
        admin_exists = db.query(models.User).filter(models.User.username == "admin").first()
        
        if not admin_exists:
            print("Création du compte admin en cours...")
            hashed_password = pwd_context.hash("fokontany2026")
            new_admin = models.User(
                username="admin",
                hashed_password=hashed_password
            )
            db.add(new_admin)
            db.commit()
            print("✅ Compte administrateur créé avec succès !")
        else:
            print("ℹ️ Le compte admin existe déjà.")
    except Exception as e:
        print(f"❌ Erreur lors de l'initialisation : {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_admin()