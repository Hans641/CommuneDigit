#!/usr/bin/env python3
"""
CommuneDigit — Script de création du compte administrateur
Usage : python create_admin.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models.models import (
    Agent, Fokontany, CatalogueService, ProjetCommune, CompteCitoyen, Citoyen
)
from datetime import datetime

def create_tables():
    Base.metadata.create_all(bind=engine)
    print("✅ Tables créées / vérifiées")

def create_admin():
    db = SessionLocal()
    try:
        # ── Fokontany ────────────────────────────────────────────
        if db.query(Fokontany).count() == 0:
            foks = [
                Fokontany(nom="Sabotsy Namehana", commune="Antananarivo", latitude=-18.87, longitude=47.55, population=12400),
                Fokontany(nom="Ambohimanga",      commune="Antananarivo", latitude=-18.77, longitude=47.53, population=8200),
                Fokontany(nom="Ivandry",          commune="Antananarivo", latitude=-18.88, longitude=47.50, population=15600),
                Fokontany(nom="Ankorondrano",     commune="Antananarivo", latitude=-18.90, longitude=47.52, population=9800),
                Fokontany(nom="Ambodivona",       commune="Antananarivo", latitude=-18.91, longitude=47.54, population=7300),
            ]
            db.add_all(foks)
            db.flush()
            print(f"✅ {len(foks)} fokontany créés")
        else:
            print(f"ℹ️  Fokontany existants : {db.query(Fokontany).count()}")

        # ── Agent Admin ──────────────────────────────────────────
        existing = db.query(Agent).filter(Agent.matricule == "AGT-0001").first()
        if existing:
            # Mettre à jour le mot de passe
            existing.hashed_password = hash_password("admin123")
            db.flush()
            print(f"✅ Agent admin existant mis à jour — matricule : AGT-0001")
        else:
            admin = Agent(
                matricule="AGT-0001",
                nom="RANOHARISON",
                prenom="Hans",
                role="Administrateur",
                fokontany="Tous",
                email="admin@communedigit.mg",
                telephone="034 00 000 00",
                hashed_password=hash_password("admin123"),
                is_active=True,
            )
            db.add(admin)
            db.flush()
            print(f"✅ Agent admin créé — matricule : AGT-0001")

        # ── Agents supplémentaires ───────────────────────────────
        agents_extra = [
            dict(matricule="AGT-0002", nom="Rakoto", prenom="Jean", role="Agent Fokontany",
                 fokontany="Sabotsy Namehana", email="agent@communedigit.mg",
                 telephone="034 11 111 11", password="agent123"),
            dict(matricule="AGT-0003", nom="Rabe", prenom="Ministre", role="Ministère MID",
                 fokontany="Tous", email="mid@communedigit.mg",
                 telephone="034 22 222 22", password="mid2024"),
        ]
        for a in agents_extra:
            if not db.query(Agent).filter(Agent.matricule == a["matricule"]).first():
                db.add(Agent(
                    matricule=a["matricule"], nom=a["nom"], prenom=a["prenom"],
                    role=a["role"], fokontany=a["fokontany"], email=a["email"],
                    telephone=a["telephone"], hashed_password=hash_password(a["password"])
                ))
                print(f"✅ Agent {a['matricule']} créé")

        # ── Catalogue services ───────────────────────────────────
        if db.query(CatalogueService).count() == 0:
            from app.main import CATALOGUE_INITIAL
            for svc in CATALOGUE_INITIAL:
                db.add(CatalogueService(**svc))
            db.flush()
            print(f"✅ Catalogue : {len(CATALOGUE_INITIAL)} services créés")
        else:
            print(f"ℹ️  Catalogue existant : {db.query(CatalogueService).count()} services")

        # ── Projets ──────────────────────────────────────────────
        if db.query(ProjetCommune).count() == 0:
            from app.main import PROJETS_INITIAUX
            for p in PROJETS_INITIAUX:
                db.add(ProjetCommune(**p))
            db.flush()
            print(f"✅ {len(PROJETS_INITIAUX)} projets communaux créés")
        else:
            print(f"ℹ️  Projets existants : {db.query(ProjetCommune).count()}")

        db.commit()
        print("\n" + "="*55)
        print("🎉  INITIALISATION TERMINÉE")
        print("="*55)
        print("\n📋  COMPTES AGENTS :")
        print("   Matricule : AGT-0001  |  Mot de passe : admin123  (Administrateur)")
        print("   Matricule : AGT-0002  |  Mot de passe : agent123  (Agent Fokontany)")
        print("   Matricule : AGT-0003  |  Mot de passe : mid2024   (Ministère MID)")
        print("\n🏛️  PORTAIL CITOYEN :")
        print("   Les citoyens s'inscrivent eux-mêmes via /espace-citoyen")
        print("   Aucun compte citoyen de démo n'est créé")
        print("="*55)

    except Exception as e:
        db.rollback()
        print(f"\n❌  Erreur : {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    create_tables()
    create_admin()
