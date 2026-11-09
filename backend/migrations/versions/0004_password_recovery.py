"""One-use password resets and persistent throttling

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('password_reset_limits',
    sa.Column('bucket', sa.String(length=64), nullable=False),
    sa.Column('count', sa.Integer(), nullable=False),
    sa.Column('window_start', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('bucket')
    )
    with op.batch_alter_table('password_reset_limits', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_password_reset_limits_window_start'), ['window_start'], unique=False)

    op.create_table('password_resets',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('compte_id', sa.Integer(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('used_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['compte_id'], ['comptes_citoyens.id'], ),
    sa.PrimaryKeyConstraint('token_hash')
    )
    with op.batch_alter_table('password_resets', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_password_resets_compte_id'), ['compte_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_password_resets_expires_at'), ['expires_at'], unique=False)



def downgrade():
    with op.batch_alter_table('password_resets', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_password_resets_expires_at'))
        batch_op.drop_index(batch_op.f('ix_password_resets_compte_id'))

    op.drop_table('password_resets')
    with op.batch_alter_table('password_reset_limits', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_password_reset_limits_window_start'))

    op.drop_table('password_reset_limits')
