"""Durable, leased email delivery. External sends are at-least-once, not exactly-once."""
from datetime import datetime, timedelta
from uuid import uuid4
import smtplib

from sqlalchemy import and_, or_, update, select
from app.core.config import get_settings
from app.models.models import NotificationEmail, Notification, CompteCitoyen
from app.services.mail_service import send_email

MAX_ATTEMPTS = 5
LEASE_SECONDS = 120


def eligible(now):
    return or_(
        and_(NotificationEmail.status == 'pending', NotificationEmail.next_attempt_at <= now),
        and_(NotificationEmail.status == 'processing', NotificationEmail.lease_until <= now),
    )


def claim(sessions, now):
    with sessions() as db:
        id = db.execute(select(NotificationEmail.id).where(eligible(now)).order_by(
            NotificationEmail.next_attempt_at, NotificationEmail.id).limit(1)).scalar_one_or_none()
        if id is None:
            return None
        token = str(uuid4())
        result = db.execute(update(NotificationEmail).where(
            NotificationEmail.id == id, eligible(now),
        ).values(status='processing', lease_token=token,
                 lease_until=now + timedelta(seconds=LEASE_SECONDS),
                 attempts=NotificationEmail.attempts + 1))
        db.commit()
        return (id, token) if result.rowcount == 1 else None


def permanent_failure(exc):
    if isinstance(exc, smtplib.SMTPResponseException):
        return 500 <= exc.smtp_code < 600
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return bool(exc.recipients) and all(500 <= error[0] < 600 for error in exc.recipients.values())
    return False


def process_due(sessions, *, limit=25, now=None):
    """Claim and process a bounded batch; return counts without recipient/error contents."""
    settings = get_settings()
    counts = dict(sent=0, pending=0, failed=0, cancelled=0)
    if not settings.notification_email_enabled or settings.email_backend == 'disabled':
        return counts
    for _ in range(limit):
        instant = now or datetime.utcnow()
        claimed = claim(sessions, instant)
        if claimed is None:
            break
        id, token = claimed
        with sessions() as db:
            job = db.get(NotificationEmail, id)
            if not job or job.lease_token != token:
                continue
            attempts, recipient, notification_id = job.attempts, job.recipient, job.notification_id
            notification = db.get(Notification, notification_id)
            account = db.get(CompteCitoyen, notification.compte_id) if notification else None
            allowed = (notification and notification.via_email and account and account.is_active
                       and account.email == recipient)
        error = None
        if not allowed:
            status = 'cancelled'
        elif attempts > MAX_ATTEMPTS:
            status, error = 'failed', 'attempts_exhausted'
        else:
            try:
                # No rejection notes, documents or tokens in external notification bodies.
                send_email(recipient, 'CommuneDigit — mise à jour de votre dossier',
                           'Une nouvelle notification est disponible dans votre espace citoyen.\n'
                           + settings.public_frontend_url.rstrip('/') + '/',
                           message_id=f'<notification-{id}@communedigit.local>')
                status = 'sent'
            except Exception as exc:
                status = 'failed' if permanent_failure(exc) or attempts >= MAX_ATTEMPTS else 'pending'
                # SMTP exceptions may contain addresses, credentials or message text.
                error = 'delivery_rejected' if permanent_failure(exc) else 'delivery_unavailable'
        with sessions() as db:
            result = db.execute(update(NotificationEmail).where(
                NotificationEmail.id == id, NotificationEmail.status == 'processing',
                NotificationEmail.lease_token == token,
            ).values(status=status, lease_token=None, lease_until=None, last_error=error,
                     next_attempt_at=instant + timedelta(seconds=min(3600, 60 * 2 ** min(attempts - 1, 6))),
                     sent_at=(now or datetime.utcnow()) if status == 'sent' else None))
            if result.rowcount:
                if status == 'sent':
                    db.execute(update(Notification).where(Notification.id == notification_id).values(
                        email_id=f'notification-{id}'))
                db.commit()
                counts[status] += 1
    return counts
