"""Shared permissions and lifecycle rules for citizen requests."""
from fastapi import HTTPException
from app.models.models import DemandeService, Citoyen, Fokontany, PaiementDemande, Transaction
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
