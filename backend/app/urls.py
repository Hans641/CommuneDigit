from fastapi import APIRouter
from .views import router as paper_router # Import du router renommé pour clarté

router = APIRouter()

# On inclut les routes définies dans views.py
router.include_router(paper_router)