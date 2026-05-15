# CommuneDigit — Backend FastAPI

## Démarrage rapide

```bash
# 1. Backend
cd commune-backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000/api/docs

# 2. Frontend (autre terminal)
cd commune-digital
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
