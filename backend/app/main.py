"""
CommuneDigit — Application FastAPI principale
"""
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import Base, engine, get_settings
from app.core.security import hash_password
from app.models.models import Agent, Fokontany, CatalogueService, ProjetCommune
from app.routers.auth import router as auth_router
from app.routers.actes import router as actes_router
from app.routers.citoyens import router as citoyens_router
from app.routers.citoyen_space import router as citoyen_space_router
from app.routers.other_routers import (
    router_txn, router_cert, router_alertes,
    router_agents, router_fokontany, router_audit,
    router_dashboard, router_sync, router_public,
    router_demandes,
)

settings = get_settings()

CATALOGUE_INITIAL = [
    # ── État civil ──────────────────────────────────────────────
    dict(
        code="ACTE_NAISSANCE", icone="👶",
        nom="Acte de naissance", nom_mg="Taratasy fahaterahan'ny zaza",
        description="Acte officiel enregistrant une naissance dans la commune.",
        description_mg="Taratasy ofisialy manamarina ny fahaterahan'ny zaza.",
        categorie="État civil", prix_ar=0, delai_jours=2,
        documents_requis=[
            {"code": "CERT_RESIDENCE_PARENTS", "label": "Certificat de résidence des parents", "obligatoire": True,  "obtainable_here": True},
            {"code": "CIN_PARENTS",             "label": "CIN des deux parents",                "obligatoire": True,  "obtainable_here": False},
        ]
    ),
    dict(
        code="ACTE_MARIAGE", icone="💍",
        nom="Acte de mariage", nom_mg="Taratasy fanambadiana",
        description="Acte officiel enregistrant un mariage.",
        description_mg="Taratasy ofisialy manamarina ny fanambadiana.",
        categorie="État civil", prix_ar=0, delai_jours=3,
        documents_requis=[
            {"code": "ACTE_NAISSANCE_EPOUX",    "label": "Acte de naissance des deux époux",   "obligatoire": True,  "obtainable_here": True},
            {"code": "CERT_RESIDENCE_EPOUX",    "label": "Certificat de résidence des époux",  "obligatoire": True,  "obtainable_here": True},
            {"code": "CIN_EPOUX",               "label": "CIN des deux époux",                 "obligatoire": True,  "obtainable_here": False},
        ]
    ),
    dict(
        code="ACTE_DECES", icone="🕊️",
        nom="Acte de décès", nom_mg="Taratasy fahafatesana",
        description="Acte officiel enregistrant un décès.",
        description_mg="Taratasy ofisialy manamarina ny fahafatesana.",
        categorie="État civil", prix_ar=0, delai_jours=2,
        documents_requis=[
            {"code": "CERT_RESIDENCE_DEFUNT",   "label": "Certificat de résidence du défunt",  "obligatoire": True,  "obtainable_here": True},
            {"code": "ACTE_NAISSANCE_DEFUNT",   "label": "Acte de naissance du défunt",        "obligatoire": False, "obtainable_here": True},
            {"code": "CERT_MEDICAL_DECES",      "label": "Certificat médical de décès",        "obligatoire": True,  "obtainable_here": False},
        ]
    ),
    # ── Certificats ─────────────────────────────────────────────
    dict(
        code="CERT_RESIDENCE", icone="🏠",
        nom="Certificat de résidence", nom_mg="Taratasy fonenana",
        description="Attestation officielle de résidence dans un fokontany.",
        description_mg="Fanamarinana ofisialy ny fonenana ao amin'ny fokontany.",
        categorie="Certificat", prix_ar=2000, delai_jours=1,
        documents_requis=[
            {"code": "CIN",                     "label": "Carte d'identité nationale (CIN)",   "obligatoire": True,  "obtainable_here": False},
        ]
    ),
    dict(
        code="CERT_HERITAGE", icone="⚖️",
        nom="Certificat d'héritage", nom_mg="Taratasy lova",
        description="Document attestant les droits de succession.",
        description_mg="Taratasy manamarina ny zom-palana lova.",
        categorie="Certificat", prix_ar=5000, delai_jours=5,
        documents_requis=[
            {"code": "ACTE_DECES_DEFUNT",       "label": "Acte de décès du défunt",            "obligatoire": True,  "obtainable_here": True},
            {"code": "ACTE_NAISSANCE_HERITIERS", "label": "Actes de naissance des héritiers",  "obligatoire": True,  "obtainable_here": True},
            {"code": "CIN_HERITIERS",           "label": "CIN des héritiers",                  "obligatoire": True,  "obtainable_here": False},
        ]
    ),
    dict(
        code="CERT_VIE",  icone="✅",
        nom="Certificat de vie", nom_mg="Taratasy velona",
        description="Atteste que la personne est en vie (retraite, pension).",
        description_mg="Manamarina fa velona ny olona (fisotroan-drano, tombontsoa).",
        categorie="Certificat", prix_ar=1000, delai_jours=1,
        documents_requis=[
            {"code": "CIN",                     "label": "Carte d'identité nationale",         "obligatoire": True,  "obtainable_here": False},
        ]
    ),
    # ── Permis & Autorisations ───────────────────────────────────
    dict(
        code="PERMIS_CONSTRUCTION", icone="🏗️",
        nom="Permis de construire", nom_mg="Fanakinana fanorenana",
        description="Autorisation officielle pour travaux de construction.",
        description_mg="Alalana ofisialy hanorina trano.",
        categorie="Permis", prix_ar=50000, delai_jours=15,
        documents_requis=[
            {"code": "CERT_RESIDENCE",          "label": "Certificat de résidence",            "obligatoire": True,  "obtainable_here": True},
            {"code": "PLAN_CONSTRUCTION",       "label": "Plans de construction signés",       "obligatoire": True,  "obtainable_here": False},
            {"code": "TITRE_FONCIER",           "label": "Titre foncier ou acte de propriété", "obligatoire": True,  "obtainable_here": False},
        ]
    ),
    dict(
        code="AUTORISATION_COMMERCE", icone="🏪",
        nom="Autorisation d'exercice commercial", nom_mg="Alalana ho an'ny varotra",
        description="Licence permettant l'ouverture d'un commerce.",
        description_mg="Fahazoan-dalana hamokatra varotra.",
        categorie="Permis", prix_ar=25000, delai_jours=7,
        documents_requis=[
            {"code": "CERT_RESIDENCE",          "label": "Certificat de résidence",            "obligatoire": True,  "obtainable_here": True},
            {"code": "CIN",                     "label": "Carte d'identité nationale",         "obligatoire": True,  "obtainable_here": False},
            {"code": "PLAN_LOCAL",              "label": "Plan du local commercial",           "obligatoire": False, "obtainable_here": False},
        ]
    ),
    # ── Taxes ───────────────────────────────────────────────────
    dict(
        code="TAXE_RESIDENCE", icone="💳",
        nom="Paiement taxe de résidence", nom_mg="Fandoavana hetra fonenana",
        description="Taxe annuelle de résidence à acquitter auprès de la commune.",
        description_mg="Hetra isan-taona amin'ny fonenana ao amin'ny kaominina.",
        categorie="Taxe", prix_ar=25000, delai_jours=1,
        documents_requis=[
            {"code": "CIN",                     "label": "Carte d'identité nationale",         "obligatoire": True,  "obtainable_here": False},
        ]
    ),
]

PROJETS_INITIAUX = [
    dict(
        titre="Route pavée Sabotsy – Ambohimanga",
        description="Construction de 3,2 km de route pavée reliant Sabotsy Namehana à Ambohimanga pour désenclaver 8 000 habitants.",
        categorie="Infrastructure", statut="En cours",
        budget_ar=850_000_000, fokontany="Sabotsy Namehana",
        debut_prevu=datetime(2024, 6, 1), fin_prevue=datetime(2025, 12, 31),
    ),
    dict(
        titre="Centre de santé communautaire Ivandry",
        description="Construction d'un nouveau centre de santé de base avec maternité et laboratoire pour servir 15 000 résidents.",
        categorie="Santé", statut="Planifié",
        budget_ar=420_000_000, fokontany="Ivandry",
        debut_prevu=datetime(2025, 3, 1), fin_prevue=datetime(2026, 9, 30),
    ),
    dict(
        titre="Réseau d'eau potable Ankorondrano",
        description="Extension du réseau d'adduction d'eau potable vers 2 400 foyers non desservis dans le fokontany d'Ankorondrano.",
        categorie="Infrastructure", statut="Planifié",
        budget_ar=310_000_000, fokontany="Ankorondrano",
        debut_prevu=datetime(2025, 7, 1), fin_prevue=datetime(2026, 6, 30),
    ),
    dict(
        titre="École primaire publique Ambodivona",
        description="Construction de 6 nouvelles salles de classe et réhabilitation des sanitaires pour accueillir 240 élèves supplémentaires.",
        categorie="Éducation", statut="En cours",
        budget_ar=180_000_000, fokontany="Ambodivona",
        debut_prevu=datetime(2024, 9, 1), fin_prevue=datetime(2025, 6, 30),
    ),
    dict(
        titre="Digitalisation du Fokontany Ambohimanga",
        description="Déploiement des tablettes, connexion internet et formation des agents pour numériser 100% des actes d'état civil.",
        categorie="Numérique", statut="Terminé",
        budget_ar=45_000_000, fokontany="Ambohimanga",
        debut_prevu=datetime(2024, 1, 1), fin_prevue=datetime(2024, 5, 31),
    ),
]


def seed_db():
    from app.core.config import SessionLocal
    db = SessionLocal()
    try:
        # Fokontany
        if db.query(Fokontany).count() == 0:
            foks = [
                Fokontany(nom="Sabotsy Namehana", commune="Antananarivo", latitude=-18.87, longitude=47.55, population=12400, is_online=True),
                Fokontany(nom="Ambohimanga",      commune="Antananarivo", latitude=-18.77, longitude=47.53, population=8200, is_online=True),
                Fokontany(nom="Ivandry",          commune="Antananarivo", latitude=-18.88, longitude=47.50, population=15600, is_online=True),
                Fokontany(nom="Ankorondrano",     commune="Antananarivo", latitude=-18.90, longitude=47.52, population=9800, is_online=True),
                Fokontany(nom="Ambodivona",       commune="Antananarivo", latitude=-18.91, longitude=47.54, population=7300, is_online=True),
            ]
            db.add_all(foks)
            db.flush()

        # Agents (sans comptes citoyens de démo)
        if db.query(Agent).count() == 0:
            agents = [
                Agent(matricule="AGT-0001", nom="RANOHARISON", prenom="Hans", role="Administrateur",
                      fokontany="Tous", email="admin@communedigit.mg", telephone="034 00 000 00",
                      hashed_password=hash_password("admin123")),
                Agent(matricule="AGT-0002", nom="Rakoto", prenom="Jean", role="Agent Fokontany",
                      fokontany="Sabotsy Namehana", email="agent@communedigit.mg", telephone="034 11 111 11",
                      hashed_password=hash_password("agent123")),
                Agent(matricule="AGT-0003", nom="Rabe", prenom="Ministre", role="Ministère MID",
                      fokontany="Tous", email="mid@communedigit.mg", telephone="034 22 222 22",
                      hashed_password=hash_password("mid2024")),
            ]
            db.add_all(agents)
            db.flush()

        # Catalogue services
        if db.query(CatalogueService).count() == 0:
            for svc_data in CATALOGUE_INITIAL:
                db.add(CatalogueService(**svc_data))
            db.flush()

        # Projets
        if db.query(ProjetCommune).count() == 0:
            for p in PROJETS_INITIAUX:
                db.add(ProjetCommune(**p))
            db.flush()

        db.commit()
        print("✅ Base initialisée — aucun citoyen de démo, agents réels uniquement")
    except Exception as e:
        db.rollback()
        print(f"⚠️  Seed : {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_db()
    print(f"🚀 {settings.app_name} — http://localhost:8081/api/docs")
    yield
    print("🛑 Arrêt")


app = FastAPI(
    title="CommuneDigit API",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

origins = [o.strip() for o in settings.allowed_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api"
app.include_router(auth_router,           prefix=PREFIX)
app.include_router(citoyen_space_router,  prefix=PREFIX)
app.include_router(citoyens_router,       prefix=PREFIX)
app.include_router(actes_router,          prefix=PREFIX)
app.include_router(router_txn,            prefix=PREFIX)
app.include_router(router_cert,           prefix=PREFIX)
app.include_router(router_alertes,        prefix=PREFIX)
app.include_router(router_agents,         prefix=PREFIX)
app.include_router(router_fokontany,      prefix=PREFIX)
app.include_router(router_audit,          prefix=PREFIX)
app.include_router(router_dashboard,      prefix=PREFIX)
app.include_router(router_sync,           prefix=PREFIX)
app.include_router(router_public,         prefix=PREFIX)
app.include_router(router_demandes,       prefix=PREFIX)

@app.get("/api/health", tags=["Système"])
def health():
    return {"status": "ok", "app": settings.app_name}

@app.get("/", include_in_schema=False)
def root():
    return JSONResponse({"message": "CommuneDigit API"})

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)
