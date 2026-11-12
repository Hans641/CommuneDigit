"""Shared permissions and lifecycle rules for citizen requests."""
from fastapi import HTTPException
from app.core.config import get_settings
from app.models.models import DemandeService, Citoyen, Fokontany, PaiementDemande, Transaction, Certificat
from sqlalchemy.orm import object_session
from decimal import Decimal

OPERATORS = ("Administrateur", "Superviseur", "Agent Fokontany")
APPROVERS = ("Administrateur", "Superviseur")
READERS = OPERATORS + ("Ministère MID",)
TRANSITIONS = {
    "Soumise": {"En traitement", "Rejetée"},
    "En traitement": {"Approuvée", "Rejetée"},
    "Approuvée": {"Prête"},
    "Prête": set(),
    "Rejetée": set(),
}


def scoped_requests(db, agent):
    query = db.query(DemandeService)
    if agent.role not in READERS:
        raise HTTPException(403, "Rôle non autorisé")
    if agent.role == "Agent Fokontany":
        query = query.join(Citoyen, DemandeService.citoyen_id == Citoyen.id).join(
            Fokontany, Citoyen.fokontany_id == Fokontany.id,
        ).filter(Fokontany.nom == agent.fokontany)
    return query


def require_paid(demande):
    if demande.montant_ar <= 0:
        return
    db = object_session(demande)
    payment = db.query(Transaction).join(
        PaiementDemande, PaiementDemande.transaction_id == Transaction.id,
    ).filter(PaiementDemande.demande_id == demande.id,
             Transaction.statut == "Confirmé", Transaction.citoyen_id == demande.citoyen_id).first()
    if payment and payment.type_paiement == "Démo" and not get_settings().payment_demo_enabled:
        raise HTTPException(409, "Un paiement simulé ne permet pas une délivrance hors mode démo")
    if (demande.statut_paiement != "Payé" or not payment
            or Decimal(str(payment.montant)) != Decimal(str(demande.montant_ar))):
        raise HTTPException(409, "Paiement vérifié requis avant délivrance")


def validate_transition(demande, target, agent):
    if agent.role not in OPERATORS:
        raise HTTPException(403, "Traitement réservé aux agents opérationnels")
    if target not in {"En traitement", "Approuvée", "Rejetée", "Prête"}:
        raise HTTPException(422, "Statut invalide")
    if target in {"Approuvée", "Prête"} and agent.role not in APPROVERS:
        raise HTTPException(403, "Approbation réservée aux superviseurs et administrateurs")
    if demande.statut == target:
        return
    if target not in TRANSITIONS.get(demande.statut, set()):
        raise HTTPException(409, f"Transition interdite : {demande.statut} → {target}")
    if target == "Prête":
        require_paid(demande)


def agent_territory(db, agent):
    """Resolve a unique assignment; an absent/ambiguous assignment grants no access."""
    if agent.role not in READERS:
        raise HTTPException(403, "Rôle non autorisé")
    if agent.role != "Agent Fokontany":
        return None
    matches = db.query(Fokontany.id).filter(Fokontany.nom == agent.fokontany).all()
    if len(matches) != 1:
        raise HTTPException(403, "Fokontany non affecté ou ambigu")
    return matches[0][0]


def scoped_records(db, agent, model):
    scope = agent_territory(db, agent)
    query = db.query(model)
    if scope is not None:
        if model is Certificat:
            query = query.join(Citoyen, Certificat.citoyen_id == Citoyen.id).filter(
                Citoyen.fokontany_id == scope)
        else:
            query = query.filter(model.fokontany_id == scope)
    return query


def validate_record_territory(db, agent, fokontany_id, *, default=False):
    scope = agent_territory(db, agent)
    if default and fokontany_id is None:
        fokontany_id = scope
    if scope is not None and fokontany_id != scope:
        raise HTTPException(403, "Écriture hors du fokontany affecté interdite")
    if fokontany_id is not None and db.get(Fokontany, fokontany_id) is None:
        raise HTTPException(422, "Fokontany introuvable")
    return fokontany_id


def linked_citizen(db, agent, citizen_id):
    if citizen_id is None:
        if agent_territory(db, agent) is not None:
            raise HTTPException(422, "Citoyen rattaché requis")
        return None
    citizen = scoped_records(db, agent, Citoyen).filter(Citoyen.id == citizen_id).first()
    if citizen is None:
        raise HTTPException(404, "Citoyen introuvable")
    return citizen
