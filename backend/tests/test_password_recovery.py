import hashlib
import re
import uuid
from datetime import datetime, timedelta
from email import policy
from email.parser import BytesParser
import pytest
from fastapi.testclient import TestClient
from test_citizen_workflow import app, register, SessionLocal
from app.core.config import get_settings
from app.models.models import PasswordReset, PasswordResetLimit, CompteCitoyen
from app.services.mail_service import send_email


@pytest.fixture
def recovery(monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), 'email_backend', 'file')
    monkeypatch.setattr(get_settings(), 'email_outbox_dir', str(tmp_path / 'mail'))
    with SessionLocal() as db:
        db.query(PasswordResetLimit).delete()
        db.commit()
    with TestClient(app) as client:
        email = uuid.uuid4().hex + '@example.com'
        headers = register(client, email)
        yield client, email, headers, tmp_path / 'mail'


def forgot(client, email):
    return client.post('/api/espace-citoyen/forgot-password', json={'email': email})


def token_from_mail(directory):
    messages = list(directory.glob('*.eml'))
    assert len(messages) == 1
    message = BytesParser(policy=policy.default).parsebytes(messages[0].read_bytes())
    token = re.search(r'/reset-password#token=([\w-]+)', message.get_content()).group(1)
    assert messages[0].stat().st_mode & 0o777 == 0o600
    assert directory.stat().st_mode & 0o777 == 0o700
    return token


def reset(client, token, password='updated-password'):
    return client.post('/api/espace-citoyen/reset-password', json={
        'token': token, 'nouveau_password': password, 'confirmer_password': password})


def test_reset_once_and_revoke_sessions(recovery):
    c, email, headers, directory = recovery
    missing = forgot(c, 'missing@example.com')
    existing = forgot(c, email.upper())
    assert missing.status_code == existing.status_code == 202
    assert missing.json() == existing.json()
    assert 'token' not in existing.text
    token = token_from_mail(directory)
    with SessionLocal() as db:
        entry = db.get(PasswordReset, hashlib.sha256(token.encode()).hexdigest())
        assert entry and entry.token_hash != token
    assert reset(c, token).status_code == 200
    assert reset(c, token).status_code == 401
    assert c.get('/api/espace-citoyen/profil', headers=headers).status_code == 401
    assert c.post('/api/espace-citoyen/login', json={'email': email, 'password': 'password123'}).status_code == 401
    assert c.post('/api/espace-citoyen/login', json={'email': email, 'password': 'updated-password'}).status_code == 200


def test_expired_inactive_and_change_password(recovery):
    c, email, headers, directory = recovery
    forgot(c, email)
    token = token_from_mail(directory)
    with SessionLocal() as db:
        entry = db.get(PasswordReset, hashlib.sha256(token.encode()).hexdigest())
        entry.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    assert reset(c, token).status_code == 401
    with SessionLocal() as db:
        db.get(PasswordReset, hashlib.sha256(token.encode()).hexdigest()).expires_at = datetime.utcnow() + timedelta(hours=1)
        account = db.query(CompteCitoyen).filter_by(email=email).one()
        account.is_active = False
        db.commit()
    assert reset(c, token).status_code == 401
    with SessionLocal() as db:
        db.query(CompteCitoyen).filter_by(email=email).one().is_active = True
        db.commit()
    r = c.post('/api/espace-citoyen/change-password', headers=headers, json={
        'ancien_password': 'password123', 'nouveau_password': 'changed-password', 'confirmer_password': 'changed-password'})
    assert r.status_code == 200
    assert reset(c, token).status_code == 401
    assert c.get('/api/espace-citoyen/profil', headers=headers).status_code == 401


def test_throttle_and_previous_link_invalidation(recovery):
    c, email, headers, directory = recovery
    for _ in range(3):
        assert forgot(c, email).status_code == 202
    old = token_from_mail(directory)
    with SessionLocal() as db:
        # Move rate-limit windows back without sleeping.
        for bucket in db.query(PasswordResetLimit):
            bucket.window_start = datetime.utcnow() - timedelta(hours=1)
        db.commit()
    for path in directory.glob('*.eml'):
        path.unlink()
    assert forgot(c, email).status_code == 202
    current = token_from_mail(directory)
    assert current != old
    assert reset(c, old).status_code == 401
    assert reset(c, current).status_code == 200


def test_ip_limit_and_delivery_failure(recovery, monkeypatch):
    c, email, _, directory = recovery
    for i in range(10):
        assert forgot(c, f'missing-{i}@example.com').status_code == 202
    assert forgot(c, email).status_code == 202
    assert not directory.exists()
    with SessionLocal() as db:
        db.query(PasswordResetLimit).delete()
        db.commit()
    def fail(*args):
        raise RuntimeError('Delivery unavailable')
    monkeypatch.setattr('app.services.password_recovery.send_email', fail)
    assert forgot(c, email).status_code == 202
    with SessionLocal() as db:
        account = db.query(CompteCitoyen).filter_by(email=email).one()
        assert db.query(PasswordReset).filter_by(compte_id=account.id).count() == 0


def test_smtp_uses_verified_tls(monkeypatch):
    events = []
    class SMTP:
        def __init__(self, *args, **kwargs):
            events.append('connect')
            assert kwargs['timeout'] == 10
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def starttls(self, context):
            import ssl
            assert context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname
            events.append('tls')
        def login(self, user, password): events.append('login')
        def send_message(self, message): events.append('send')
    settings = get_settings()
    monkeypatch.setattr(settings, 'email_backend', 'smtp')
    monkeypatch.setattr(settings, 'smtp_host', 'smtp.example.com')
    monkeypatch.setattr(settings, 'smtp_username', 'test')
    monkeypatch.setattr('app.services.mail_service.smtplib.SMTP', SMTP)
    send_email('citizen@example.com', 'Test', 'Test')
    assert events == ['connect', 'tls', 'login', 'send']


from test_migrations import database


def test_concurrent_token_consumption(database):
    from concurrent.futures import ThreadPoolExecutor
    from sqlalchemy.orm import sessionmaker
    from app.schema import upgrade_database
    from app.core.security import hash_password
    from app.models.models import Citoyen
    from app.services.password_recovery import consume_reset
    from fastapi import HTTPException
    upgrade_database(database)
    sessions = sessionmaker(bind=database)
    token = 'concurrent-reset-token-with-sufficient-entropy-for-test'
    with sessions() as db:
        citizen = Citoyen(nom='Test', prenom='Reset', telephone='0340000000')
        db.add(citizen)
        db.flush()
        account = CompteCitoyen(email='concurrency@example.com', citoyen_id=citizen.id,
                                hashed_password=hash_password('old-password'), is_active=True)
        db.add(account)
        db.flush()
        db.add(PasswordReset(token_hash=hashlib.sha256(token.encode()).hexdigest(),
                             compte_id=account.id, expires_at=datetime.utcnow() + timedelta(hours=1)))
        db.commit()
    def attempt(_):
        with sessions() as db:
            try:
                consume_reset(db, token, 'new-password')
                return 200
            except HTTPException as error:
                return error.status_code
    with ThreadPoolExecutor(max_workers=2) as workers:
        assert sorted(workers.map(attempt, range(2))) == [200, 401]



def test_disabled_delivery_and_legacy_reset_token(recovery, monkeypatch):
    from app.core.security import create_access_token
    c, email, _, _ = recovery
    monkeypatch.setattr(get_settings(), 'email_backend', 'disabled')
    assert forgot(c, email).status_code == forgot(c, 'unknown@example.com').status_code == 503
    legacy = create_access_token({'sub': '1', 'type': 'reset'})
    assert reset(c, legacy).status_code == 401
    assert reset(c, 'x' * 40, 'short').status_code == 422
