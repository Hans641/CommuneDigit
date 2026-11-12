"""Durable transactional email notifications.

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('notification_emails',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('notification_id', sa.String(36), sa.ForeignKey('notifications.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('recipient', sa.String(200), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('next_attempt_at', sa.DateTime(), nullable=False),
        sa.Column('lease_token', sa.String(36)),
        sa.Column('lease_until', sa.DateTime()),
        sa.Column('last_error', sa.String(50)),
        sa.Column('sent_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_notification_emails_next_attempt_at', 'notification_emails', ['next_attempt_at'])


def downgrade():
    op.drop_index('ix_notification_emails_next_attempt_at', table_name='notification_emails')
    op.drop_table('notification_emails')
