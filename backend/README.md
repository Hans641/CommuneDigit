# CommuneDigit — Backend FastAPI

## Démarrage rapide

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
alembic upgrade head  # nouvelle base uniquement
uvicorn app.main:app --reload
# → http://localhost:8000/api/docs

# 2. Frontend (autre terminal)
cd ../frontend
npm install && npm run dev
# → http://localhost:5173
```

## Comptes de démo
| Matricule   | Mot de passe | Rôle            |
|-------------|-------------|-----------------|
| `AGT-0001`  | `admin123`  | Administrateur  |
| `AGT-0002`  | `agent123`  | Agent Fokontany |
| `AGT-0003`  | `mid2024`   | Ministère MID   |

## Endpoints principaux
- `POST /api/auth/login` — Connexion JWT
- `GET  /api/dashboard/stats` — KPIs temps réel
- `GET  /api/citoyens` — Liste citoyens (paginé)
- `POST /api/actes` — Créer acte état civil (SHA-256)
- `POST /api/transactions` — Paiement (idempotence ACID)
- `POST /api/sync` — Synchronisation offline-first (LWW)
- `GET  /api/audit` — Journal d'audit immuable

## Production PostgreSQL
Modifier `.env` :
```
DATABASE_URL=postgresql://user:pass@localhost:5432/communedigit_db
```

## Schéma versionné

Avant le premier démarrage, appliquer `alembic upgrade head` depuis `backend`. Pour une base existante non versionnée : sauvegarder, puis `python -m app.schema adopt`. Voir [MIGRATIONS.md](MIGRATIONS.md). Le serveur et les commandes de création de compte ne modifient plus le schéma automatiquement.

## Synchronisation

`POST /api/sync/` applique réellement les créations et modifications autorisées. `GET /api/sync/citoyen` et `/api/sync/acte` proposent un journal paginé avec curseurs serveur. Voir [OFFLINE_SYNC.md](OFFLINE_SYNC.md) pour les checksums, conflits, reçus et retraits de cache. Le stockage local et la file mobile restent à intégrer.
