"""Opaque one-use reset tokens, persistent throttling and session invalidation."""
import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta
from urllib.parse import quote
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.core.config import get_settings
from app.core.security import hash_password
from app.models.models import CompteCitoyen, PasswordReset, PasswordResetLimit
from app.services.mail_service import send_email

logger = logging.getLogger(__name__)


def invalidate_resets(db, account_id):
    db.query(PasswordReset).filter(PasswordReset.compte_id == account_id,
                                  PasswordReset.used_at.is_(None)).update(
        {'used_at': datetime.utcnow()}, synchronize_session=False)


def allowed(db, email, ip, now):
    settings = get_settings()
    db.query(PasswordReset).filter(PasswordReset.expires_at < now - timedelta(days=1)).delete()
    # Purge only expired limiter buckets; no account information is stored here.
    db.query(PasswordResetLimit).filter(PasswordResetLimit.window_start < now - timedelta(days=1)).delete()
    for prefix, value, limit, seconds in [('ip', ip, 10, 900), ('email', email, 1, 60)]:
        key = hmac.new(settings.secret_key.encode(), (prefix + ':' + value).encode(), hashlib.sha256).hexdigest()
        bucket = db.query(PasswordResetLimit).filter_by(bucket=key).with_for_update().first()
        if bucket is None:
            bucket = PasswordResetLimit(bucket=key, count=0, window_start=now)
            db.add(bucket)
        if bucket.window_start <= now - timedelta(seconds=seconds):
            bucket.count, bucket.window_start = 0, now
        bucket.count = min(bucket.count + 1, limit + 1)
        if bucket.count > limit:
            db.flush()
            return False
    db.flush()
    return True


def request_reset(db, email, ip):
    settings = get_settings()
    if settings.email_backend == 'disabled':
        raise HTTPException(503, 'Récupération de compte temporairement indisponible')
    now = datetime.utcnow()
    try:
        permitted = allowed(db, email, ip, now)
        db.commit()
    except IntegrityError:
        db.rollback()
        return  # Concurrent first requests never bypass throttling.
    if not permitted:
        return
    account = db.query(CompteCitoyen).filter(CompteCitoyen.email == email,
                                           CompteCitoyen.is_active == True).with_for_update().first()
    if account is None:
        return
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode()).hexdigest()
    invalidate_resets(db, account.id)
    db.add(PasswordReset(token_hash=digest, compte_id=account.id,
                         expires_at=now + timedelta(hours=1)))
    db.commit()
    link = settings.public_frontend_url.rstrip('/') + '/reset-password#token=' + quote(token)
    try:
        send_email(account.email, 'CommuneDigit — Réinitialisation du mot de passe',
                   'Ce lien expire dans une heure et ne fonctionne qu’une fois.\n\n' + link +
                   '\n\nSi vous n’avez pas demandé ce changement, ignorez ce message.')
    except Exception:
        # Never log a link, token, SMTP credential or recipient here.
        db.query(PasswordReset).filter_by(token_hash=digest).delete()
        db.commit()
        logger.error('Envoi du courrier de récupération impossible ; jeton invalidé')


def consume_reset(db, token, password):
    now = datetime.utcnow()
    digest = hashlib.sha256(token.encode()).hexdigest()
    reset = db.query(PasswordReset).filter_by(token_hash=digest).first()
    invalid = HTTPException(401, 'Lien invalide, expiré ou déjà utilisé')
    if not reset:
        raise invalid
    account = db.query(CompteCitoyen).filter(CompteCitoyen.id == reset.compte_id,
                                           CompteCitoyen.is_active == True).with_for_update().first()
    if account is None:
        raise invalid
    # Conditional consumption is atomic, including two requests racing on one token.
    consumed = db.query(PasswordReset).filter(
        PasswordReset.token_hash == digest, PasswordReset.used_at.is_(None),
        PasswordReset.expires_at > now,
    ).update({'used_at': now}, synchronize_session=False)
    if not consumed:
        db.rollback()
        raise invalid
    account.hashed_password = hash_password(password)
    invalidate_resets(db, account.id)
    db.commit()
