"""
CommuneDigit — Service de génération de documents
Génère les documents finalisés pour les citoyens
Peut générer: PDF, HTML, documents signés, etc.
"""
import os
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple
from io import BytesIO

from sqlalchemy.orm import Session

from app.models.models import DocumentFinal, DemandeService, EvenementDemande


# Configuration
DOCUMENTS_DIR = Path(os.getenv("DOCUMENTS_DIR", "/tmp/commune_documents"))
DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

DOCUMENT_VALIDITY_DAYS = 30  # Documents valables 30 jours


class DocumentGenerationService:
    """Service de génération et gestion de documents finalisés."""
    
    @staticmethod
    def generate_document_content(demande: DemandeService) -> bytes:
        """
        Génère le contenu du document finalisé.
        
        En production, utiliser:
        - reportlab pour PDF
        - jinja2 pour templating
        - signature numérique
        
        Pour l'MVP, générer un HTML simple.
        """
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }}
                .header {{ text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }}
                .header h1 {{ margin: 0; color: #064e3b; }}
                .header p {{ margin: 5px 0; font-size: 0.9em; color: #666; }}
                .content {{ margin: 30px 0; }}
                .field {{ margin: 15px 0; }}
                .field-label {{ font-weight: bold; color: #333; }}
                .field-value {{ margin-top: 5px; color: #555; }}
                .footer {{ 
                    margin-top: 40px; 
                    padding-top: 20px; 
                    border-top: 1px solid #ccc;
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9em;
                }}
                .seal {{ 
                    border: 2px solid #064e3b; 
                    border-radius: 50%; 
                    width: 100px; 
                    height: 100px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    font-weight: bold;
                    color: #064e3b;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>République de Madagascar</h1>
                <p>Commune Urbaine d'Antananarivo — CommuneDigit</p>
                <h2>{demande.service.nom if demande.service else 'Document'}</h2>
                <p style="color: #10b981;">Ref: {demande.reference}</p>
            </div>
            
            <div class="content">
                <div class="field">
                    <div class="field-label">Demandeur:</div>
                    <div class="field-value">
                        {demande.citoyen.prenom} {demande.citoyen.nom if demande.citoyen else 'N/A'}
                    </div>
                </div>
                
                <div class="field">
                    <div class="field-label">Téléphone:</div>
                    <div class="field-value">{demande.citoyen.telephone if demande.citoyen else 'N/A'}</div>
                </div>
                
                <div class="field">
                    <div class="field-label">Focal d'inscription:</div>
                    <div class="field-value">
                        {demande.citoyen.fokontany_rel.nom if demande.citoyen and demande.citoyen.fokontany_rel else 'N/A'}
                    </div>
                </div>
                
                <div class="field">
                    <div class="field-label">Date de demande:</div>
                    <div class="field-value">{demande.created_at.strftime('%d/%m/%Y à %H:%M')}</div>
                </div>
                
                <div class="field">
                    <div class="field-label">Statut:</div>
                    <div class="field-value">{demande.statut}</div>
                </div>
                
                {f'<div class="field"><div class="field-label">Message de l\'agent:</div><div class="field-value">{demande.note_agent}</div></div>' if demande.note_agent else ''}
            </div>
            
            <div class="footer">
                <div>
                    <div>Fait à Antananarivo</div>
                    <div>{datetime.utcnow().strftime('%d/%m/%Y')}</div>
                </div>
                <div class="seal">CACHET<br>OFFICIEL</div>
                <div>
                    <div>L'Agent Habilité</div>
                    <div style="margin-top: 40px;">_________________</div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html_content.encode('utf-8')

    @staticmethod
    def save_document(
        demande: DemandeService,
        content: bytes,
        doc_type: str = "PDF",
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Sauvegarde un document finalisé.
        
        Returns:
            (url_telechargement, hash_sha256)
        """
        
        # Hash du contenu
        content_hash = hashlib.sha256(content).hexdigest()
        
        # Nom sécurisé
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{demande.reference}_{timestamp}.html"
        
        # Répertoire par citoyen/demande
        doc_dir = DOCUMENTS_DIR / str(demande.compte_id) / demande.id
        doc_dir.mkdir(parents=True, exist_ok=True)
        file_path = doc_dir / filename
        
        try:
            with open(file_path, "wb") as f:
                f.write(content)
            
            url = f"/documents/{demande.compte_id}/{demande.id}/{filename}"
            return url, content_hash
        except Exception as e:
            print(f"Erreur sauvegarde document: {e}")
            return None, None

    @staticmethod
    def create_or_update_document(
        db: Session,
        demande: DemandeService,
        agent_id: int = None,
    ) -> Optional[DocumentFinal]:
        """Crée ou met à jour le document final d'une demande."""
        
        # Générer le contenu
        content = DocumentGenerationService.generate_document_content(demande)
        
        # Sauvegarder
        url, content_hash = DocumentGenerationService.save_document(demande, content)
        
        if not url:
            return None
        
        # Vérifier si un document existe déjà
        existing = db.query(DocumentFinal).filter(
            DocumentFinal.demande_id == demande.id
        ).first()
        
        if existing:
            existing.url_telechargement = url
            existing.hash_sha256 = content_hash
            existing.taille_bytes = len(content)
            existing.date_generation = datetime.utcnow()
        else:
            doc = DocumentFinal(
                demande_id=demande.id,
                type_document="HTML",
                url_telechargement=url,
                nom_fichier=f"{demande.reference}.html",
                taille_bytes=len(content),
                hash_sha256=content_hash,
                agent_id=agent_id,
                expires_at=datetime.utcnow() + timedelta(days=DOCUMENT_VALIDITY_DAYS),
            )
            db.add(doc)
        
        db.commit()
        
        # Mettre à jour la demande
        demande.document_final = url
        db.commit()
        
        return existing or doc

    @staticmethod
    def get_document(db: Session, demande_id: str) -> Optional[DocumentFinal]:
        """Récupère le document finalisé d'une demande."""
        return db.query(DocumentFinal).filter(
            DocumentFinal.demande_id == demande_id
        ).first()

    @staticmethod
    def is_document_valid(doc: DocumentFinal) -> bool:
        """Vérifie si le document est toujours valide."""
        if not doc or not doc.expires_at:
            return False
        return datetime.utcnow() <= doc.expires_at

    @staticmethod
    def get_document_file(url: str) -> Optional[Path]:
        """Récupère le chemin physique d'un document."""
        
        rel_path = url.lstrip("/documents/")
        file_path = DOCUMENTS_DIR / rel_path
        
        try:
            file_path.resolve().relative_to(DOCUMENTS_DIR.resolve())
            if file_path.exists():
                return file_path
        except (ValueError, FileNotFoundError):
            pass
        
        return None

    @staticmethod
    def delete_document(db: Session, demande_id: str) -> bool:
        """Supprime le document finalisé d'une demande."""
        doc = DocumentGenerationService.get_document(db, demande_id)
        if doc:
            # Supprimer le fichier
            file_path = DocumentGenerationService.get_document_file(doc.url_telechargement)
            if file_path:
                try:
                    file_path.unlink()
                except:
                    pass
            
            # Supprimer l'enregistrement
            db.delete(doc)
            db.commit()
            return True
        
        return False

    @staticmethod
    def is_document_valid(doc: DocumentFinal) -> bool:
        """Vérifie si un document est encore valable."""
        if doc.expires_at:
            return datetime.utcnow() <= doc.expires_at
        return True


# Fonction utilitaire d'événement
def log_document_event(
    db: Session,
    demande: DemandeService,
    type_event: str,
    description: str = None,
    agent_id: int = None,
):
    """Enregistre un événement lié au document."""
    from app.models.models import EvenementDemande
    
    event = EvenementDemande(
        demande_id=demande.id,
        type_event=type_event,
        description=description,
        agent_id=agent_id,
    )
    db.add(event)
    db.commit()
