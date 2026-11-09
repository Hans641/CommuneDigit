"""Transactional offline change feed and receipts

Revision ID: 0005
Revises: 0004
"""
from datetime import datetime
from uuid import uuid4
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('sync_changes',
    sa.Column('version', sa.BigInteger(), nullable=False),
    sa.Column('entity_type', sa.String(length=20), nullable=False),
    sa.Column('entity_id', sa.String(length=36), nullable=False),
    sa.Column('old_fokontany_id', sa.Integer(), nullable=True),
    sa.Column('new_fokontany_id', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('version', 'entity_type', 'entity_id')
    )
    op.create_table('sync_clock',
    sa.Column('instance_id', sa.String(length=36), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('value', sa.BigInteger(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sync_receipts',
    sa.Column('operation_key', sa.String(length=64), nullable=False),
    sa.Column('agent_id', sa.Integer(), nullable=False),
    sa.Column('entity_type', sa.String(length=20), nullable=False),
    sa.Column('entity_id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.PrimaryKeyConstraint('operation_key')
    )
    with op.batch_alter_table('actes_etat_civil', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sync_version', sa.BigInteger(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('sync_updated_at', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_actes_etat_civil_sync_updated_at'), ['sync_updated_at'], unique=False)

    with op.batch_alter_table('citoyens', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sync_version', sa.BigInteger(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('sync_updated_at', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_citoyens_sync_updated_at'), ['sync_updated_at'], unique=False)

    clock = sa.table('sync_clock', sa.column('id', sa.Integer()), sa.column('value', sa.BigInteger()), sa.column('instance_id', sa.String(36)))
    op.bulk_insert(clock, [{'id': 1, 'value': 0, 'instance_id': str(uuid4())}])
    changes = sa.table('sync_changes', sa.column('version'), sa.column('entity_type'),
                       sa.column('entity_id'), sa.column('old_fokontany_id'), sa.column('new_fokontany_id'))
    for name, kind in [('citoyens', 'citoyen'), ('actes_etat_civil', 'acte')]:
        table = sa.table(name, sa.column('id'), sa.column('fokontany_id'), sa.column('sync_updated_at', sa.DateTime()))
        op.get_bind().execute(table.update().values(sync_updated_at=datetime.utcnow()))
        op.get_bind().execute(changes.insert().from_select(
            ['version', 'entity_type', 'entity_id', 'old_fokontany_id', 'new_fokontany_id'],
            sa.select(sa.literal(0), sa.literal(kind), table.c.id, table.c.fokontany_id, table.c.fokontany_id)))


def downgrade():
    # Native DROP COLUMN keeps referenced parent tables intact on SQLite >=3.35.
    for name in ('citoyens', 'actes_etat_civil'):
        op.drop_index(f'ix_{name}_sync_updated_at', table_name=name)
        op.drop_column(name, 'sync_updated_at')
        op.drop_column(name, 'sync_version')
    op.drop_table('sync_receipts')
    op.drop_table('sync_changes')
    op.drop_table('sync_clock')
