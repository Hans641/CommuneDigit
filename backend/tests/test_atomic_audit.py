"""Verify rollback of business, sync and audit rows on actual SQL failures."""
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select
from sqlalchemy.orm import Session
from test_citizen_workflow import app, SessionLocal
from app.core.security import create_access_token, hash_password
from app.models.models import Agent, Citoyen, ActeEtatCivil, Certificat, Alerte, AuditLog, Transaction, SyncClock, SyncChange


@pytest.fixture
def api():
    with TestClient(app, raise_server_exceptions=False) as client:
        with SessionLocal() as db:
            admin = Agent(matricule=uuid4().hex[:20], nom='Audit', prenom='Admin', role='Administrateur',
                          fokontany='Tous', hashed_password=hash_password('atomic-test-password'))
            agent = Agent(matricule=uuid4().hex[:20], nom='Audit', prenom='Target', role='Agent Fokontany',
                          fokontany='Sabotsy Namehana', hashed_password='unused')
            citizen = Citoyen(nom='Audit', prenom='Citizen', telephone='0340000000')
            db.add_all([admin, agent, citizen])
            db.flush()
            acte = ActeEtatCivil(reference=uuid4().hex[:20], type_acte='Naissance', nom_concerne='Audit',
                                 date_evenement=datetime(2024, 1, 1))
            cert = Certificat(reference=uuid4().hex[:20], type_cert='Résidence', citoyen_id=citizen.id)
            db.add_all([acte, cert])
            db.commit()
            headers = {'Authorization': 'Bearer ' + create_access_token({'sub': str(admin.id)})}
            ids = dict(admin=admin.id, agent=agent.id, citizen=citizen.id, acte=acte.id, cert=cert.id)
            credentials = dict(username=admin.matricule, password='atomic-test-password')
        yield client, headers, ids, credentials


def snapshot():
    with SessionLocal() as db:
        return {m.__tablename__: db.execute(select(m.__table__).order_by(*m.__table__.primary_key.columns)).all()
                for m in (Agent, Citoyen, ActeEtatCivil, Certificat, Alerte, AuditLog, Transaction, SyncClock, SyncChange)}


CASES = [
    ('citizen-create', 'CREATE', 'Citoyen'), ('citizen-update', 'UPDATE', 'Citoyen'),
    ('citizen-delete', 'DELETE', 'Citoyen'), ('acte-create', 'CREATE', 'ActeEtatCivil'),
    ('acte-update', 'UPDATE', 'ActeEtatCivil'), ('acte-validate', 'VALIDATE', 'ActeEtatCivil'),
    ('cert-create', 'CREATE', 'Certificat'), ('cert-update', 'UPDATE', 'Certificat'),
    ('cert-deliver', 'VALIDATE', 'Certificat'), ('alert-create', 'ALERT', 'Alerte'),
    ('agent-create', 'CREATE', 'Agent'), ('agent-update', 'UPDATE', 'Agent'),
    ('agent-delete', 'DELETE', 'Agent'), ('login', 'LOGIN', 'Session'),
    ('transaction-create', 'VALIDATE', 'Transaction'),
]


def operation(case, ids, credentials):
    return {
        'citizen-create': ('POST', '/citoyens/', dict(nom='New audit', prenom='Test', telephone='0340000000')),
        'citizen-update': ('PATCH', '/citoyens/' + ids['citizen'], dict(nom='Changed audit')),
        'citizen-delete': ('DELETE', '/citoyens/' + ids['citizen'], None),
        'acte-create': ('POST', '/actes/', dict(type_acte='Naissance', nom_concerne='New audit', date_evenement='2024-01-01')),
        'acte-update': ('PATCH', '/actes/' + ids['acte'], dict(nom_concerne='Changed audit')),
        'acte-validate': ('POST', '/actes/' + ids['acte'] + '/valider', None),
        'cert-create': ('POST', '/certificats/', dict(type_cert='Résidence', citoyen_id=ids['citizen'])),
        'cert-update': ('PATCH', '/certificats/' + ids['cert'], dict(motif='Changed audit')),
        'cert-deliver': ('POST', '/certificats/' + ids['cert'] + '/delivrer', None),
        'alert-create': ('POST', '/alertes/', dict(type_alerte='Infos', titre='Audit test', corps='Message de test audit')),
        'agent-create': ('POST', '/agents/', dict(nom='New audit', prenom='Agent', fokontany='Sabotsy Namehana', password='new-test-password')),
        'agent-update': ('PATCH', '/agents/' + str(ids['agent']), dict(nom='Changed audit')),
        'agent-delete': ('DELETE', '/agents/' + str(ids['agent']), None),
        'login': ('POST', '/auth/login', credentials),
        'transaction-create': ('POST', '/transactions/', dict(citoyen_id=ids['citizen'], montant=2000,
            type_paiement='Espèces', idempotency_key=uuid4().hex, reference_externe='test-receipt')),
    }[case]


@pytest.mark.parametrize('case,action,entity', CASES, ids=[c[0] for c in CASES])
@pytest.mark.parametrize('failure', [None, 'audit-insert', 'commit'])
def test_atomic_audit(api, case, action, entity, failure):
    c, headers, ids, credentials = api
    before = snapshot()
    method, path, body = operation(case, ids, credentials)
    fired = []

    def fail(*args):
        fired.append(True)
        raise RuntimeError('Injected database failure')

    target, hook = (AuditLog, 'before_insert') if failure == 'audit-insert' else (Session, 'before_commit')
    if failure:
        event.listen(target, hook, fail)
    try:
        response = c.request(method, '/api' + path, headers=headers, json=body)
    finally:
        if failure:
            event.remove(target, hook, fail)
    if failure:
        assert fired, 'Failure injection must execute'
        assert response.status_code == 500, response.text
        assert snapshot() == before, 'Business, sync feed and audit must all roll back'
    else:
        assert response.status_code == (201 if case.endswith('-create') else 204 if method == 'DELETE' else 200), response.text
        with SessionLocal() as db:
            assert db.query(AuditLog).count() == len(before['audit_logs']) + 1
            audit = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
            assert (audit.action, audit.entite, audit.agent_id) == (action, entity, ids['admin'])
            expected_id = (str(response.json()['id']) if case.endswith('-create') else
                           str(ids[case.split('-')[0]]) if case != 'login' else None)
            assert audit.entite_id == expected_id
            assert audit.detail and len(audit.detail) > 10
            assert audit.ip_address == 'testclient'
            assert audit.niveau_risque == ('Élevé' if method == 'DELETE' else 'Moyen' if entity == 'Transaction' else 'Faible')
            assert len(audit.hash_sha256) == 64
        after = snapshot()
        business_table = {'Citoyen': 'citoyens', 'ActeEtatCivil': 'actes_etat_civil',
                          'Certificat': 'certificats', 'Alerte': 'alertes',
                          'Agent': 'agents', 'Session': 'agents', 'Transaction': 'transactions'}[entity]
        assert after[business_table] != before[business_table]
        if entity in {'Citoyen', 'ActeEtatCivil'}:
            assert after['sync_changes'] != before['sync_changes']
        if case == 'login':
            with SessionLocal() as db:
                assert db.get(Agent, ids['admin']).last_login is not None
