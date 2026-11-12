"""Transactional email queue and delivery/recovery behavior on disposable databases."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Barrier, local
from uuid import uuid4
import smtplib

import pytest
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker
from test_migrations import database
from app.core.config import get_settings
from app.models.models import CompteCitoyen, Notification, NotificationEmail
from app.schema import upgrade_database
from app.services.notification_service import NotificationService
from app.services.email_delivery import process_due, claim, MAX_ATTEMPTS, LEASE_SECONDS


@pytest.fixture
def mailbox(database, monkeypatch, tmp_path):
    upgrade_database(database)
    settings = get_settings()
    for key, value in dict(notification_email_enabled=True, email_backend='file',
                           email_outbox_dir=str(tmp_path / 'mail'), public_frontend_url='https://commune.example').items():
        monkeypatch.setattr(settings, key, value)
    sessions = sessionmaker(bind=database, expire_on_commit=False)
    with sessions() as db:
        account = CompteCitoyen(email='notifications@example.com', hashed_password='test-only')
        db.add(account)
        db.commit()
        account_id = account.id
    return sessions, account_id, tmp_path / 'mail'


def enqueue(sessions, account_id, *, commit=True):
    with sessions() as db:
        account = db.get(CompteCitoyen, account_id)
        notif = NotificationService.create_notification(db, account, 'TRAITEMENT', commit=False)
        NotificationService.send_notification(db, notif, account)
        if commit:
            db.commit()
        return notif.id


def test_enqueue_and_delivery_are_separate(mailbox):
    sessions, aid, directory = mailbox
    nid = enqueue(sessions, aid)
    assert not directory.exists()
    with sessions() as db:
        assert db.query(NotificationEmail).count() == 1
        assert db.get(Notification, nid).email_id is None
    assert process_due(sessions)['sent'] == 1
    assert process_due(sessions)['sent'] == 0
    mail = list(directory.glob('*.eml'))
    assert len(mail) == 1
    assert 'https://commune.example/' in mail[0].read_text()
    with sessions() as db:
        job = db.query(NotificationEmail).one()
        assert job.status == 'sent' and job.attempts == 1 and job.sent_at
        assert db.get(Notification, nid).email_id == 'notification-' + job.id
        assert ('notification-' + job.id) in mail[0].read_text()


def test_rollback_and_disabled_delivery(mailbox, monkeypatch):
    sessions, aid, directory = mailbox
    enqueue(sessions, aid, commit=False)
    with sessions() as db:
        assert db.query(Notification).count() == db.query(NotificationEmail).count() == 0
    monkeypatch.setattr(get_settings(), 'notification_email_enabled', False)
    nid = enqueue(sessions, aid)
    with sessions() as db:
        assert not db.get(Notification, nid).via_email
        assert db.query(NotificationEmail).count() == 0
    assert not any(process_due(sessions).values()) and not directory.exists()


def test_transient_retry_and_attempt_limit(mailbox, monkeypatch):
    sessions, aid, directory = mailbox
    enqueue(sessions, aid)
    def fail(*args, **kwargs):
        raise smtplib.SMTPDataError(451, b'private recipient or provider detail')
    monkeypatch.setattr('app.services.email_delivery.send_email', fail)
    instant = datetime.utcnow() + timedelta(seconds=1)
    assert process_due(sessions, now=instant)['pending'] == 1
    assert not any(process_due(sessions, now=instant).values())
    with sessions() as db:
        job = db.query(NotificationEmail).one()
        assert job.attempts == 1 and job.last_error == 'delivery_unavailable'
    for attempt in range(2, MAX_ATTEMPTS + 1):
        instant += timedelta(hours=2)
        result = process_due(sessions, now=instant)
    assert result['failed'] == 1
    assert not any(process_due(sessions, now=instant + timedelta(days=1)).values())
    with sessions() as db:
        job = db.query(NotificationEmail).one()
        assert job.status == 'failed' and job.attempts == MAX_ATTEMPTS
        assert db.query(Notification).count() == 1


def test_retry_recovers_after_outage(mailbox, monkeypatch):
    sessions, aid, directory = mailbox
    enqueue(sessions, aid)
    from app.services.email_delivery import send_email
    def fail(*args, **kwargs):
        raise OSError('temporary network failure')
    monkeypatch.setattr('app.services.email_delivery.send_email', fail)
    instant = datetime.utcnow() + timedelta(seconds=1)
    assert process_due(sessions, now=instant)['pending'] == 1
    monkeypatch.setattr('app.services.email_delivery.send_email', send_email)
    assert process_due(sessions, now=instant + timedelta(minutes=2))['sent'] == 1
    assert len(list(directory.glob('*.eml'))) == 1


def test_permanent_failure_is_not_retried(mailbox, monkeypatch):
    sessions, aid, _ = mailbox
    enqueue(sessions, aid)
    def fail(*args, **kwargs):
        raise smtplib.SMTPRecipientsRefused({'private@example.com': (550, b'private detail')})
    monkeypatch.setattr('app.services.email_delivery.send_email', fail)
    assert process_due(sessions)['failed'] == 1
    assert not any(process_due(sessions, now=datetime.utcnow() + timedelta(days=1)).values())
    with sessions() as db:
        assert db.query(NotificationEmail).one().last_error == 'delivery_rejected'


def test_expired_lease_is_recovered(mailbox):
    sessions, aid, _ = mailbox
    enqueue(sessions, aid)
    instant = datetime.utcnow() + timedelta(seconds=1)
    assert claim(sessions, instant)
    assert not any(process_due(sessions, now=instant).values())
    assert process_due(sessions, now=instant + timedelta(seconds=LEASE_SECONDS + 1))['sent'] == 1


def test_parallel_workers_claim_once(mailbox):
    sessions, aid, directory = mailbox
    enqueue(sessions, aid)
    barrier, state, hits = Barrier(2), local(), []
    engine = sessions.kw['bind']
    def sync(connection, cursor, sql, parameters, context, executemany):
        if sql.startswith('UPDATE notification_emails') and not getattr(state, 'synced', False):
            state.synced = True
            hits.append(True)
            barrier.wait(timeout=10)
    event.listen(engine, 'before_cursor_execute', sync)
    try:
        with ThreadPoolExecutor(max_workers=2) as workers:
            results = list(workers.map(lambda _: process_due(sessions), range(2)))
    finally:
        event.remove(engine, 'before_cursor_execute', sync)
    assert len(hits) == 2
    assert sum(r['sent'] for r in results) == 1
    assert len(list(directory.glob('*.eml'))) == 1


@pytest.mark.parametrize('change', ['inactive', 'email', 'deleted'])
def test_stale_recipient_or_deleted_notification_not_sent(mailbox, change):
    sessions, aid, directory = mailbox
    nid = enqueue(sessions, aid)
    with sessions() as db:
        if change == 'inactive':
            db.get(CompteCitoyen, aid).is_active = False
        elif change == 'email':
            db.get(CompteCitoyen, aid).email = 'changed@example.com'
        else:
            db.delete(db.get(Notification, nid))
        db.commit()
    result = process_due(sessions)
    assert result['sent'] == 0
    assert result['cancelled'] == (0 if change == 'deleted' else 1)
    assert not directory.exists()


def test_mailjet_worker_uses_verified_starttls(mailbox, monkeypatch):
    sessions, aid, _ = mailbox
    enqueue(sessions, aid)
    settings = get_settings()
    for key, value in dict(email_backend='smtp', smtp_host='in-v3.mailjet.com', smtp_port=587,
                           smtp_username='test-key', smtp_password='test-secret').items():
        monkeypatch.setattr(settings, key, value)
    events = []
    class SMTP:
        def __init__(self, host, port, timeout):
            assert (host, port, timeout) == ('in-v3.mailjet.com', 587, 10)
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def starttls(self, context):
            import ssl
            assert context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname
            events.append('tls')
        def login(self, username, password):
            assert (username, password) == ('test-key', 'test-secret')
            events.append('auth')
        def send_message(self, message):
            assert message['Message-ID'] and message['To'] == 'notifications@example.com'
            events.append('send')
    monkeypatch.setattr('app.services.mail_service.smtplib.SMTP', SMTP)
    assert process_due(sessions)['sent'] == 1
    assert events == ['tls', 'auth', 'send']


def test_api_submission_and_transition_enqueue_atomically(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient
    from test_citizen_workflow import app, SessionLocal, register
    from app.models.models import CatalogueService, DemandeService, Agent
    from app.core.security import create_access_token
    settings = get_settings()
    monkeypatch.setattr(settings, 'notification_email_enabled', True)
    monkeypatch.setattr(settings, 'email_backend', 'file')
    directory = tmp_path / 'api-mail'
    monkeypatch.setattr(settings, 'email_outbox_dir', str(directory))
    code = 'EMAIL-' + uuid4().hex[:12]
    with TestClient(app, raise_server_exceptions=False) as c:
        citizen = register(c, uuid4().hex + '@example.com')
        with SessionLocal() as db:
            db.add(CatalogueService(code=code, nom='Email workflow', categorie='Certificat', prix_ar=0,
                                    documents_requis=[]))
            admin = db.query(Agent).filter_by(matricule='AGT-0001').one()
            auth = {'Authorization': 'Bearer ' + create_access_token({'sub': str(admin.id)})}
            db.commit()
        r = c.post('/api/espace-citoyen/demandes', headers=citizen, json={'service_code': code})
        assert r.status_code == 201, r.text
        with SessionLocal() as db:
            demand = db.query(DemandeService).filter_by(service_code=code).one()
            did = demand.id
            notif = db.query(Notification).filter_by(demande_id=did).one()
            assert notif.email_delivery.status == 'pending'
        assert not directory.exists()
        path = '/api/demandes-citoyens/' + did
        assert c.patch(path, headers=auth, json={'statut': 'En traitement'}).status_code == 200
        assert c.patch(path, headers=auth, json={'statut': 'En traitement'}).status_code == 200
        assert process_due(SessionLocal)['sent'] == 2
        assert len(list(directory.glob('*.eml'))) == 2
        with SessionLocal() as db:
            assert db.query(Notification).filter_by(demande_id=did).count() == 2
            before = db.query(DemandeService).filter_by(service_code=code).count()
        def fail(*args):
            raise RuntimeError('Queue insertion failed')
        event.listen(NotificationEmail, 'before_insert', fail)
        try:
            r = c.post('/api/espace-citoyen/demandes', headers=citizen, json={'service_code': code})
        finally:
            event.remove(NotificationEmail, 'before_insert', fail)
        assert r.status_code == 500
        with SessionLocal() as db:
            assert db.query(DemandeService).filter_by(service_code=code).count() == before


def test_last_attempt_crash_ends_in_failure(mailbox):
    sessions, aid, directory = mailbox
    enqueue(sessions, aid)
    instant = datetime.utcnow() + timedelta(seconds=1)
    with sessions() as db:
        db.query(NotificationEmail).one().attempts = MAX_ATTEMPTS - 1
        db.commit()
    assert claim(sessions, instant)
    assert process_due(sessions, now=instant + timedelta(seconds=LEASE_SECONDS + 1))['failed'] == 1
    assert not directory.exists()


def test_upgrade_preserves_history_without_replaying_email(database):
    from alembic import command
    from app.schema import config
    with database.begin() as connection:
        command.upgrade(config(connection), '0005')
    sessions = sessionmaker(bind=database)
    with sessions() as db:
        account = CompteCitoyen(email='history@example.com', hashed_password='test-only')
        db.add(account)
        db.flush()
        notif = Notification(compte_id=account.id, type_notif='TRAITEMENT', titre='History', message='Preserve', via_email=True)
        db.add(notif)
        db.commit()
        nid = notif.id
    upgrade_database(database)
    with sessions() as db:
        assert db.get(Notification, nid).message == 'Preserve'
        assert db.query(NotificationEmail).count() == 0
    with database.begin() as connection:
        command.downgrade(config(connection), '0005')
    upgrade_database(database)
    with sessions() as db:
        assert db.get(Notification, nid).message == 'Preserve'
        assert db.query(NotificationEmail).count() == 0
