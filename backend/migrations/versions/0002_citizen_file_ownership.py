"""Citizen file ownership

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('fichiers_citoyens',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('compte_id', sa.Integer(), nullable=False),
    sa.Column('demande_id', sa.String(length=36), nullable=True),
    sa.Column('nom_fichier', sa.String(length=300), nullable=False),
    sa.Column('type_code', sa.String(length=100), nullable=False),
    sa.Column('url_fichier', sa.String(length=500), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=True),
    sa.Column('taille_bytes', sa.Integer(), nullable=True),
    sa.Column('hash_sha256', sa.String(length=64), nullable=True),
    sa.Column('obtenu_ici', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['compte_id'], ['comptes_citoyens.id'], ),
    sa.ForeignKeyConstraint(['demande_id'], ['demandes_service.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('fichiers_citoyens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_fichiers_citoyens_compte_id'), ['compte_id'], unique=False)



def downgrade():
    op.drop_index('ix_fichiers_citoyens_compte_id', table_name='fichiers_citoyens')
    op.drop_table('fichiers_citoyens')
