"""
CommuneDigit — Service de notifications
Gère l'envoi et le suivi des notifications aux citoyens
Intégration future: SMS (Africa's Talking), Email, Push notifications
"""
from datetime import datetime
from typing import List, Optional
from enum import Enum

from sqlalchemy.orm import Session

from app.models.models import Notification, CompteCitoyen, DemandeService, NotificationEmail
from app.core.config import get_settings


class TypeNotification(str, Enum):
    CREATION = "CREATION"
    SOUMISSION = "SOUMISSION"
    TRAITEMENT = "TRAITEMENT"
    APPROBATION = "APPROBATION"
    REJET = "REJET"
    PRET = "PRET"
    PAIEMENT = "PAIEMENT"


class NotificationService:
    """Service centralisé de gestion des notifications."""
    
    # Template des messages
    TEMPLATES = {
        TypeNotification.CREATION: {
            "titre": "Demande créée",
            "message": "Votre demande {service} a été créée. Ref: {reference}",
        },
        TypeNotification.SOUMISSION: {
            "titre": "Demande soumise",
            "message": "Votre demande {service} a été soumise avec succès. Numéro de suivi: {reference}",
        },
        TypeNotification.TRAITEMENT: {
            "titre": "En traitement",
            "message": "Votre demande est en cours de traitement. Un agent s'occupera de votre dossier.",
        },
        TypeNotification.APPROBATION: {
            "titre": "Demande approuvée",
            "message": "Votre demande a été approuvée! Consultez votre espace pour plus de détails.",
        },
        TypeNotification.REJET: {
            "titre": "Demande rejetée",
            "message": "Votre demande a été rejetée. Message: {note}",
        },
        TypeNotification.PRET: {
            "titre": "Document prêt",
            "message": "Votre {service} est prêt à être téléchargé! Allez dans 'Mes demandes'.",
        },
        TypeNotification.PAIEMENT: {
            "titre": "Paiement confirmé",
            "message": "Votre paiement de {montant} Ar a été confirmé.",
        },
    }

    @staticmethod
    def create_notification(
        db: Session,
        compte_citoyen: CompteCitoyen,
        type_notif,
        demande: DemandeService = None,
        via_email: bool = True,
        via_sms: bool = False,
        via_push: bool = False,
        custom_message: str = None,
        commit: bool = True,
        **template_vars
    ) -> Notification:
        """Crée et enregistre une notification."""
        if isinstance(type_notif, str):
            type_notif = TypeNotification(type_notif)

        if via_sms or via_push:
            raise ValueError("Transport SMS/push non configuré")
        settings = get_settings()
        via_email = bool(via_email and settings.notification_email_enabled
                         and settings.email_backend != 'disabled' and compte_citoyen.email)
        template = NotificationService.TEMPLATES.get(type_notif, {})
        titre = template.get("titre", "Notification")
        if demande:
            template_vars.setdefault("service", demande.service.nom if demande.service else "Document")
            template_vars.setdefault("reference", demande.reference)
        message = custom_message or template.get("message", "").format(**template_vars) or titre
        
        notif = Notification(
            compte_id=compte_citoyen.id,
            demande_id=demande.id if demande else None,
            type_notif=type_notif.value,
            titre=titre,
            message=message,
            via_email=via_email,
            via_sms=via_sms,
            via_push=via_push,
        )
        
        db.add(notif)
        db.flush()
        
        # Enqueue in the business transaction; never contact a provider here.
        NotificationService.send_notification(db, notif, compte_citoyen)
        
        if commit:
            db.commit()
        return notif

    @staticmethod
    def send_notification(db: Session, notif: Notification, compte: CompteCitoyen):
        """Ensure one durable email job per notification, without sending it."""
        if notif.via_email and notif.email_delivery is None:
            notif.email_delivery = NotificationEmail(recipient=compte.email)
        db.flush()

    @staticmethod
    def get_notifications(
        db: Session,
        compte_id: int,
        limit: int = 20,
        unread_only: bool = False,
    ) -> List[Notification]:
        """Récupère les notifications d'un citoyen."""
        
        q = db.query(Notification).filter(
            Notification.compte_id == compte_id
        )
        
        if unread_only:
            q = q.filter(Notification.is_read == False)
        
        return q.order_by(Notification.created_at.desc()).limit(limit).all()

    @staticmethod
    def mark_as_read(db: Session, notification_or_id) -> bool:
        """Marque une notification comme lue."""
        notif = notification_or_id
        if not isinstance(notification_or_id, Notification):
            notif = db.query(Notification).filter(Notification.id == notification_or_id).first()
        if notif:
            notif.is_read = True
            notif.read_at = datetime.utcnow()
            db.commit()
            return True
        return False

    @staticmethod
    def mark_all_as_read(db: Session, compte_id: int) -> int:
        """Marque toutes les notifications comme lues."""
        updated = db.query(Notification).filter(
            Notification.compte_id == compte_id,
            Notification.is_read == False
        ).update(
            {"is_read": True, "read_at": datetime.utcnow()},
            synchronize_session=False
        )
        db.commit()
        return updated

    @staticmethod
    def delete_notification(db: Session, notification_or_id) -> bool:
        """Supprime une notification."""
        notif = notification_or_id
        if not isinstance(notification_or_id, Notification):
            notif = db.query(Notification).filter(Notification.id == notification_or_id).first()
        if notif:
            db.delete(notif)
            db.commit()
            return True
        return False


# Fonctions utilitaires
def notify_on_demande_transition(
    db: Session,
    demande: DemandeService,
    ancien_statut: str,
    nouveau_statut: str,
    commit: bool = True,
):
    """Notifie automatiquement lors d'une transition de statut."""
    
    if nouveau_statut == "Soumise":
        NotificationService.create_notification(
            db, demande.compte, TypeNotification.SOUMISSION,
            demande=demande, commit=commit,
            service=demande.service.nom if demande.service else "un document",
            reference=demande.reference,
        )
    
    elif nouveau_statut == "En traitement":
        NotificationService.create_notification(
            db, demande.compte, TypeNotification.TRAITEMENT, demande=demande, commit=commit
        )
    
    elif nouveau_statut == "Approuvée":
        NotificationService.create_notification(
            db, demande.compte, TypeNotification.APPROBATION, demande=demande, commit=commit
        )
    
    elif nouveau_statut == "Rejetée":
        NotificationService.create_notification(
            db, demande.compte, TypeNotification.REJET,
            demande=demande, commit=commit,
            note=demande.note_agent or "Veuillez réessayer",
        )
    
    elif nouveau_statut == "Prête":
        NotificationService.create_notification(
            db, demande.compte, TypeNotification.PRET,
            demande=demande, commit=commit,
            service=demande.service.nom if demande.service else "votre document",
        )
