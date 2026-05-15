#!/bin/bash
echo "🌿 CommuneDigit — Démarrage Backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier l'env Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 requis"
    exit 1
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
pip install -r requirements.txt -q --break-system-packages

# Démarrer le serveur
echo ""
echo "🚀 Démarrage FastAPI sur http://localhost:8000"
echo "📖 Documentation : http://localhost:8000/api/docs"
echo "📊 Frontend      : http://localhost:5173 (npm run dev)"
echo ""
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
