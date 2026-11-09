"""Payment reconciliation

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('paiements_demandes',
    sa.Column('transaction_id', sa.String(length=36), nullable=False),
    sa.Column('demande_id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['demande_id'], ['demandes_service.id'], ),
    sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ),
    sa.PrimaryKeyConstraint('transaction_id'),
    sa.UniqueConstraint('demande_id')
    )


def downgrade():
    op.drop_table('paiements_demandes')
