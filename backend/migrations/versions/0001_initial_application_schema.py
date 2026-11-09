"""Initial application schema

Revision ID: 0001
Revises: 
"""
from alembic import op
import sqlalchemy as sa


revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('agents',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('matricule', sa.String(length=20), nullable=False),
    sa.Column('nom', sa.String(length=100), nullable=False),
    sa.Column('prenom', sa.String(length=100), nullable=False),
    sa.Column('role', sa.Enum('Agent Fokontany', 'Superviseur', 'Administrateur', 'Ministère MID', name='role_enum'), nullable=False),
    sa.Column('fokontany', sa.String(length=200), nullable=False),
    sa.Column('telephone', sa.String(length=20), nullable=True),
    sa.Column('email', sa.String(length=200), nullable=True),
    sa.Column('hashed_password', sa.String(length=200), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('last_login', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('agents', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_agents_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_agents_matricule'), ['matricule'], unique=True)

    op.create_table('catalogue_services',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=50), nullable=False),
    sa.Column('nom', sa.String(length=300), nullable=False),
    sa.Column('nom_mg', sa.String(length=300), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('description_mg', sa.Text(), nullable=True),
    sa.Column('categorie', sa.String(length=100), nullable=False),
    sa.Column('prix_ar', sa.Float(), nullable=True),
    sa.Column('delai_jours', sa.Integer(), nullable=True),
    sa.Column('documents_requis', sa.JSON(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('icone', sa.String(length=10), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('catalogue_services', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_catalogue_services_code'), ['code'], unique=True)
        batch_op.create_index(batch_op.f('ix_catalogue_services_id'), ['id'], unique=False)

    op.create_table('demandes_pub',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('reference', sa.String(length=20), nullable=False),
    sa.Column('nom', sa.String(length=100), nullable=False),
    sa.Column('prenom', sa.String(length=200), nullable=False),
    sa.Column('cin', sa.String(length=30), nullable=True),
    sa.Column('telephone', sa.String(length=20), nullable=False),
    sa.Column('fokontany', sa.String(length=200), nullable=False),
    sa.Column('service', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('statut', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('demandes_pub', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_demandes_pub_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_demandes_pub_reference'), ['reference'], unique=True)

    op.create_table('fokontany',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nom', sa.String(length=200), nullable=False),
    sa.Column('commune', sa.String(length=200), nullable=False),
    sa.Column('latitude', sa.Float(), nullable=True),
    sa.Column('longitude', sa.Float(), nullable=True),
    sa.Column('population', sa.Integer(), nullable=True),
    sa.Column('is_online', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('fokontany', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_fokontany_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_fokontany_nom'), ['nom'], unique=False)

    op.create_table('projets_commune',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('titre', sa.String(length=300), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('categorie', sa.String(length=100), nullable=False),
    sa.Column('statut', sa.Enum('En cours', 'Planifié', 'Terminé', name='statut_projet_enum'), nullable=True),
    sa.Column('budget_ar', sa.Float(), nullable=True),
    sa.Column('debut_prevu', sa.DateTime(), nullable=True),
    sa.Column('fin_prevue', sa.DateTime(), nullable=True),
    sa.Column('fokontany', sa.String(length=200), nullable=True),
    sa.Column('image_url', sa.String(length=500), nullable=True),
    sa.Column('is_visible', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('projets_commune', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_projets_commune_id'), ['id'], unique=False)

    op.create_table('alertes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('type_alerte', sa.Enum('Santé', 'Sécurité', 'Admin', 'Infos', name='type_alerte_enum'), nullable=False),
    sa.Column('urgence', sa.Enum('Haute', 'Normale', name='urgence_enum'), nullable=True),
    sa.Column('titre', sa.String(length=300), nullable=False),
    sa.Column('corps', sa.Text(), nullable=False),
    sa.Column('destinataires', sa.String(length=200), nullable=True),
    sa.Column('statut', sa.Enum('Active', 'Planifiée', 'Expirée', name='statut_alerte_enum'), nullable=True),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['agents.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('alertes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_alertes_id'), ['id'], unique=False)

    op.create_table('audit_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('action', sa.String(length=20), nullable=False),
    sa.Column('entite', sa.String(length=50), nullable=False),
    sa.Column('entite_id', sa.String(length=36), nullable=True),
    sa.Column('detail', sa.Text(), nullable=True),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('ip_address', sa.String(length=50), nullable=True),
    sa.Column('niveau_risque', sa.Enum('Faible', 'Moyen', 'Élevé', name='risque_enum'), nullable=True),
    sa.Column('hash_sha256', sa.String(length=64), nullable=True),
    sa.Column('timestamp', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_audit_logs_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_logs_timestamp'), ['timestamp'], unique=False)

    op.create_table('citoyens',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('nom', sa.String(length=100), nullable=False),
    sa.Column('prenom', sa.String(length=200), nullable=False),
    sa.Column('cin', sa.String(length=30), nullable=True),
    sa.Column('telephone', sa.String(length=20), nullable=False),
    sa.Column('adresse', sa.Text(), nullable=True),
    sa.Column('fokontany_id', sa.Integer(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('last_update', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['fokontany_id'], ['fokontany.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('citoyens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_citoyens_cin'), ['cin'], unique=True)
        batch_op.create_index(batch_op.f('ix_citoyens_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_citoyens_nom'), ['nom'], unique=False)

    op.create_table('actes_etat_civil',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('reference', sa.String(length=20), nullable=False),
    sa.Column('type_acte', sa.Enum('Naissance', 'Mariage', 'Décès', name='type_acte_enum'), nullable=False),
    sa.Column('nom_concerne', sa.String(length=300), nullable=False),
    sa.Column('date_evenement', sa.DateTime(), nullable=False),
    sa.Column('lieu_evenement', sa.String(length=300), nullable=True),
    sa.Column('details_json', sa.Text(), nullable=True),
    sa.Column('statut', sa.Enum('En attente', 'En cours', 'Validé', 'Rejeté', name='statut_acte_enum'), nullable=True),
    sa.Column('hash_sha256', sa.String(length=64), nullable=True),
    sa.Column('is_validated', sa.Boolean(), nullable=True),
    sa.Column('citoyen_id', sa.String(length=36), nullable=True),
    sa.Column('fokontany_id', sa.Integer(), nullable=True),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.Column('last_update', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.ForeignKeyConstraint(['citoyen_id'], ['citoyens.id'], ),
    sa.ForeignKeyConstraint(['fokontany_id'], ['fokontany.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('actes_etat_civil', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_actes_etat_civil_reference'), ['reference'], unique=True)

    op.create_table('certificats',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('reference', sa.String(length=20), nullable=False),
    sa.Column('type_cert', sa.Enum('Résidence', 'Héritage', 'Permis', 'Autre', name='type_cert_enum'), nullable=False),
    sa.Column('citoyen_id', sa.String(length=36), nullable=True),
    sa.Column('motif', sa.Text(), nullable=True),
    sa.Column('statut', sa.Enum('En attente', 'En cours', 'Délivré', 'Rejeté', name='statut_cert_enum'), nullable=True),
    sa.Column('prix', sa.Float(), nullable=True),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.ForeignKeyConstraint(['citoyen_id'], ['citoyens.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('certificats', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_certificats_reference'), ['reference'], unique=True)

    op.create_table('comptes_citoyens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=200), nullable=False),
    sa.Column('hashed_password', sa.String(length=200), nullable=False),
    sa.Column('citoyen_id', sa.String(length=36), nullable=True),
    sa.Column('is_verified', sa.Boolean(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('last_login', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['citoyen_id'], ['citoyens.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('comptes_citoyens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_comptes_citoyens_email'), ['email'], unique=True)
        batch_op.create_index(batch_op.f('ix_comptes_citoyens_id'), ['id'], unique=False)

    op.create_table('transactions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('reference', sa.String(length=20), nullable=False),
    sa.Column('citoyen_id', sa.String(length=36), nullable=True),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('type_paiement', sa.String(length=100), nullable=False),
    sa.Column('montant', sa.Float(), nullable=False),
    sa.Column('statut', sa.Enum('En attente', 'Confirmé', 'Annulé', 'Remboursé', name='statut_txn_enum'), nullable=True),
    sa.Column('idempotency_key', sa.String(length=64), nullable=False),
    sa.Column('reference_externe', sa.String(length=200), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.ForeignKeyConstraint(['citoyen_id'], ['citoyens.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_transactions_idempotency_key'), ['idempotency_key'], unique=True)
        batch_op.create_index(batch_op.f('ix_transactions_reference'), ['reference'], unique=True)

    op.create_table('demandes_service',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('reference', sa.String(length=30), nullable=False),
    sa.Column('compte_id', sa.Integer(), nullable=False),
    sa.Column('citoyen_id', sa.String(length=36), nullable=True),
    sa.Column('service_code', sa.String(length=50), nullable=False),
    sa.Column('donnees_json', sa.JSON(), nullable=True),
    sa.Column('pieces_jointes', sa.JSON(), nullable=True),
    sa.Column('montant_ar', sa.Float(), nullable=True),
    sa.Column('statut_paiement', sa.Enum('En attente', 'Payé', 'Remboursé', name='statut_paiement_citoyen_enum'), nullable=True),
    sa.Column('reference_paiement', sa.String(length=100), nullable=True),
    sa.Column('statut', sa.Enum('Brouillon', 'Soumise', 'En traitement', 'Approuvée', 'Rejetée', 'Prête', name='statut_demande_enum'), nullable=True),
    sa.Column('note_agent', sa.Text(), nullable=True),
    sa.Column('document_final', sa.String(length=500), nullable=True),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.Column('soumise_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.ForeignKeyConstraint(['citoyen_id'], ['citoyens.id'], ),
    sa.ForeignKeyConstraint(['compte_id'], ['comptes_citoyens.id'], ),
    sa.ForeignKeyConstraint(['service_code'], ['catalogue_services.code'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('demandes_service', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_demandes_service_reference'), ['reference'], unique=True)

    op.create_table('documents_finaux',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('demande_id', sa.String(length=36), nullable=False),
    sa.Column('type_document', sa.String(length=100), nullable=False),
    sa.Column('url_telechargement', sa.String(length=500), nullable=False),
    sa.Column('nom_fichier', sa.String(length=300), nullable=False),
    sa.Column('taille_bytes', sa.Integer(), nullable=True),
    sa.Column('hash_sha256', sa.String(length=64), nullable=True),
    sa.Column('date_generation', sa.DateTime(), nullable=True),
    sa.Column('date_validation', sa.DateTime(), nullable=True),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.ForeignKeyConstraint(['demande_id'], ['demandes_service.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('documents_finaux', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_documents_finaux_demande_id'), ['demande_id'], unique=True)

    op.create_table('evenements_demande',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('demande_id', sa.String(length=36), nullable=False),
    sa.Column('type_event', sa.String(length=50), nullable=False),
    sa.Column('ancien_statut', sa.String(length=50), nullable=True),
    sa.Column('nouveau_statut', sa.String(length=50), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('timestamp', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.ForeignKeyConstraint(['demande_id'], ['demandes_service.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('evenements_demande', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_evenements_demande_demande_id'), ['demande_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_evenements_demande_timestamp'), ['timestamp'], unique=False)

    op.create_table('notifications',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('compte_id', sa.Integer(), nullable=False),
    sa.Column('demande_id', sa.String(length=36), nullable=True),
    sa.Column('type_notif', sa.Enum('CREATION', 'SOUMISSION', 'TRAITEMENT', 'APPROBATION', 'REJET', 'PRET', 'PAIEMENT', name='type_notif_enum'), nullable=False),
    sa.Column('titre', sa.String(length=200), nullable=False),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('via_email', sa.Boolean(), nullable=True),
    sa.Column('via_sms', sa.Boolean(), nullable=True),
    sa.Column('via_push', sa.Boolean(), nullable=True),
    sa.Column('is_read', sa.Boolean(), nullable=True),
    sa.Column('read_at', sa.DateTime(), nullable=True),
    sa.Column('email_id', sa.String(length=100), nullable=True),
    sa.Column('sms_id', sa.String(length=100), nullable=True),
    sa.Column('push_id', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['compte_id'], ['comptes_citoyens.id'], ),
    sa.ForeignKeyConstraint(['demande_id'], ['demandes_service.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_notifications_compte_id'), ['compte_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_notifications_demande_id'), ['demande_id'], unique=False)

    op.create_table('pieces_jointes',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('demande_id', sa.String(length=36), nullable=False),
    sa.Column('nom_fichier', sa.String(length=300), nullable=False),
    sa.Column('type_code', sa.String(length=50), nullable=False),
    sa.Column('url_fichier', sa.String(length=500), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=True),
    sa.Column('taille_bytes', sa.Integer(), nullable=True),
    sa.Column('hash_sha256', sa.String(length=64), nullable=True),
    sa.Column('obtenu_ici', sa.Boolean(), nullable=True),
    sa.Column('demande_source', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['demande_id'], ['demandes_service.id'], ),
    sa.ForeignKeyConstraint(['demande_source'], ['demandes_service.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('pieces_jointes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_pieces_jointes_demande_id'), ['demande_id'], unique=False)



def downgrade():
    with op.batch_alter_table('pieces_jointes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_pieces_jointes_demande_id'))

    op.drop_table('pieces_jointes')
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_notifications_demande_id'))
        batch_op.drop_index(batch_op.f('ix_notifications_compte_id'))

    op.drop_table('notifications')
    with op.batch_alter_table('evenements_demande', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_evenements_demande_timestamp'))
        batch_op.drop_index(batch_op.f('ix_evenements_demande_demande_id'))

    op.drop_table('evenements_demande')
    with op.batch_alter_table('documents_finaux', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_documents_finaux_demande_id'))

    op.drop_table('documents_finaux')
    with op.batch_alter_table('demandes_service', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_demandes_service_reference'))

    op.drop_table('demandes_service')
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_transactions_reference'))
        batch_op.drop_index(batch_op.f('ix_transactions_idempotency_key'))

    op.drop_table('transactions')
    with op.batch_alter_table('comptes_citoyens', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_comptes_citoyens_id'))
        batch_op.drop_index(batch_op.f('ix_comptes_citoyens_email'))

    op.drop_table('comptes_citoyens')
    with op.batch_alter_table('certificats', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_certificats_reference'))

    op.drop_table('certificats')
    with op.batch_alter_table('actes_etat_civil', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_actes_etat_civil_reference'))

    op.drop_table('actes_etat_civil')
    with op.batch_alter_table('citoyens', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_citoyens_nom'))
        batch_op.drop_index(batch_op.f('ix_citoyens_id'))
        batch_op.drop_index(batch_op.f('ix_citoyens_cin'))

    op.drop_table('citoyens')
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_audit_logs_timestamp'))
        batch_op.drop_index(batch_op.f('ix_audit_logs_id'))

    op.drop_table('audit_logs')
    with op.batch_alter_table('alertes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_alertes_id'))

    op.drop_table('alertes')
    with op.batch_alter_table('projets_commune', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_projets_commune_id'))

    op.drop_table('projets_commune')
    with op.batch_alter_table('fokontany', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_fokontany_nom'))
        batch_op.drop_index(batch_op.f('ix_fokontany_id'))

    op.drop_table('fokontany')
    with op.batch_alter_table('demandes_pub', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_demandes_pub_reference'))
        batch_op.drop_index(batch_op.f('ix_demandes_pub_id'))

    op.drop_table('demandes_pub')
    with op.batch_alter_table('catalogue_services', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_catalogue_services_id'))
        batch_op.drop_index(batch_op.f('ix_catalogue_services_code'))

    op.drop_table('catalogue_services')
    with op.batch_alter_table('agents', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_agents_matricule'))
        batch_op.drop_index(batch_op.f('ix_agents_id'))

    op.drop_table('agents')

    # Native PostgreSQL enum types outlive their tables.
    if op.get_bind().dialect.name == "postgresql":
        sa.Enum(name='risque_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='role_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='statut_acte_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='statut_alerte_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='statut_cert_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='statut_demande_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='statut_paiement_citoyen_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='statut_projet_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='statut_txn_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='type_acte_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='type_alerte_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='type_cert_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='type_notif_enum').drop(op.get_bind(), checkfirst=True)
        sa.Enum(name='urgence_enum').drop(op.get_bind(), checkfirst=True)
