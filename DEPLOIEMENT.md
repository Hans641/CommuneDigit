# 🚀 Guide de déploiement — CommuneDigit

## Prérequis

- Python 3.10+ / Node 18+ / PostgreSQL 14+
- Compte Africa's Talking (SMS/USSD)
- Serveur Linux (Ubuntu 22.04 recommandé)

---

## 1. Backend FastAPI

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Configurer la base de données
# Créer un nouveau .env sans écraser une configuration existante.
# APP_ENV=production
# DEBUG=false
# SEED_DEMO_ACCOUNTS=false
# PAYMENT_DEMO_ENABLED=false
# Renseigner DATABASE_URL, ALLOWED_ORIGINS et une SECRET_KEY privée aléatoire.
# Génération locale de la clé : openssl rand -hex 32

# Créer la DB et les tables
psql -U postgres -c "CREATE DATABASE commune_db;"
# Aucune migration Alembic versionnée n'est encore fournie.
# Créer un administrateur ; le mot de passe sera demandé sans affichage.
python manage_admin.py --matricule ADMIN-0001 --email admin@example.mg --nom Admin --prenom Commune

# Lancer en production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Avec systemd (recommandé) :**
```ini
# /etc/systemd/system/communedigit.service
[Unit]
Description=CommuneDigit API
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/opt/communedigit/backend
ExecStart=/opt/communedigit/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
EnvironmentFile=/opt/communedigit/backend/.env
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 2. Frontend React (Vite)

```bash
cd frontend
npm install

# Configurer l'URL du backend
cp .env.production .env
# Vérifier que VITE_API_URL pointe vers votre backend

# Build de production
npm run build
# → génère dist/

# Servir avec nginx (voir config ci-dessous)
```

**Config Nginx :**
```nginx
server {
    listen 443 ssl;
    server_name commune.example.mg;

    root /opt/communedigit/frontend/dist;
    index index.html;

    # SPA — toutes les routes vers index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API vers FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 3. Mobile React Native

```bash
cd mobile
npm install

# Android
npx react-native run-android --variant=release

# iOS
npx react-native run-ios --configuration Release
```

**Changer l'URL backend dans mobile :**

Éditer `mobile/src/services/api.js` ligne 8 :
```js
// Développement Android  : http://10.0.2.2:8000/api
// Développement iOS      : http://localhost:8000/api
// Production             : https://api.commune.example.mg/api
const BASE_URL = 'https://api.commune.example.mg/api';
```

---

## 4. Variables à remplir obligatoirement

| Variable | Où | Description |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | URL PostgreSQL complète |
| `SECRET_KEY` | `backend/.env` | Clé JWT 64 bytes (générer avec openssl) |
| `AT_API_KEY` | `backend/.env` | Clé Africa's Talking |
| `AT_USERNAME` | `backend/.env` | Nom d'utilisateur Africa's Talking |
| `ALLOWED_ORIGINS` | `backend/.env` | Domaine(s) du frontend |
| `VITE_API_URL` | `frontend/.env` | URL complète de l'API backend |
| `BASE_URL` | `mobile/src/services/api.js` | URL API pour l'app mobile |

---

## 5. Comptes agents par défaut

En développement avec `SEED_DEMO_ACCOUNTS=true`, ces comptes sont créés sur une base sans agents :

| Matricule | Mot de passe | Rôle |
|---|---|---|
| `AGT-0001` | `admin123` | Administrateur |
| `AGT-0002` | `agent123` | Agent Fokontany |
| `AGT-0003` | `mid2024` | Ministère MID |

En production, les comptes de démonstration ne sont pas créés. Le démarrage refuse une base contenant ces comptes actifs avec leur mot de passe par défaut ; changer leurs mots de passe ou les désactiver avant déploiement. Ne pas réutiliser une base de démonstration comme base réelle.

---

## 6. Checklist avant mise en production

- [ ] `DEBUG=false` dans `backend/.env`
- [ ] `SECRET_KEY` unique et aléatoire (64 bytes)
- [ ] Mots de passe agents par défaut changés
- [ ] HTTPS configuré (Let's Encrypt recommandé)
- [ ] `ALLOWED_ORIGINS` restreint au domaine de production
- [ ] Backup automatique PostgreSQL configuré
- [ ] Africa's Talking configuré et testé (SMS)
- [ ] URL backend dans `mobile/src/services/api.js` → production


## Paiements en démonstration

En développement uniquement, activer `PAYMENT_DEMO_ENABLED=true` dans `backend/.env`, puis redémarrer l'API. Le portail propose « Simuler le paiement » dans le détail d'une demande payante. Aucun appel opérateur ni débit réel. La transaction et la réponse API sont marquées Démo ; les montants simulés sont exclus des recettes du tableau de bord et du total des taxes.

En API : `POST /api/espace-citoyen/demandes/{id}/payer` avec `{"reference_paiement":"DEMO"}` et le jeton du citoyen propriétaire. Répéter la requête ne crée pas de nouvel encaissement. Hors mode démo, cette commande est refusée et les simulations précédentes ne permettent pas de délivrance. Le rapprochement manuel avec une transaction réelle reste disponible.

`APP_ENV=production` refuse le debug, les paiements démo, les comptes démo automatiques et une clé JWT par défaut ou de moins de 32 caractères. Les comptes créés avec `manage_admin.py` n'ont pas de mot de passe prédéfini. La publication de ces paramètres ne constitue pas un déploiement de production validé.
