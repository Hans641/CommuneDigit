import hashlib
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from test_citizen_workflow import app, SessionLocal
from app.models.models import Citoyen, ActeEtatCivil, Fokontany, SyncReceipt, AuditLog, SyncClock
from app.core.security import acte_integrity_hash, hash_record


def stamp(value=None):
    return (value or datetime.utcnow()).isoformat() + 'Z'


def record(data, kind='citoyen', id=None, timestamp=None, legacy=False):
    digest = hash_record({k: str(v) for k, v in data.items()}) if legacy else hashlib.sha256(
        json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    result = dict(entity_id=id or str(uuid4()), entity_type=kind, timestamp=timestamp or stamp(),
                  data=data, hash=digest, client_id='test-device', hash_format='legacy-v1' if legacy else 'json-v1')
    return result


@pytest.fixture
def sync_api():
    with TestClient(app) as c:
        def login(user, password):
            r = c.post('/api/auth/login', json={'username': user, 'password': password})
            assert r.status_code == 200
            return {'Authorization': 'Bearer ' + r.json()['access_token']}
        admin = login('AGT-0001', 'admin123')
        local = login('AGT-0002', 'agent123')
        mid = login('AGT-0003', 'mid2024')
        with SessionLocal() as db:
            fok = db.query(Fokontany).filter_by(nom='Sabotsy Namehana').one().id
            foreign = db.query(Fokontany).filter(Fokontany.id != fok).first().id
        yield c, admin, local, mid, fok, foreign


def push(c, headers, *records):
    r = c.post('/api/sync/', headers=headers, json={'records': list(records)})
    assert r.status_code == 200, r.text
    return r.json()


def test_create_links_utc_and_replay(sync_api):
    c, admin, local, _, fok, _ = sync_api
    timestamp = stamp(datetime.utcnow() - timedelta(seconds=30))
    citizen = record({'nom': 'HORS LIGNE', 'prenom': 'Élodie', 'telephone': '0340000000'}, timestamp=timestamp)
    acte = record({'type_acte': 'Naissance', 'nom_concerne': 'Élodie', 'date_evenement': '2024-01-02T03:00:00+03:00',
                   'citoyen_id': citizen['entity_id']}, kind='acte', timestamp=timestamp)
    first = push(c, local, citizen, acte)
    assert first['accepted'] == [citizen['entity_id'], acte['entity_id']]
    with SessionLocal() as db:
        person = db.get(Citoyen, citizen['entity_id'])
        assert person and person.fokontany_id == fok
        document = db.get(ActeEtatCivil, acte['entity_id'])
        assert document.date_evenement == datetime(2024, 1, 2)
        assert document.hash_sha256 == acte_integrity_hash(document)
        assert document.statut == 'En attente' and document.agent_id
        audit_count = db.query(AuditLog).filter(AuditLog.entite_id.in_(first['accepted'])).count()
    replay = push(c, local, citizen, acte)
    assert [x['code'] for x in replay['results']] == ['already_applied', 'already_applied']
    with SessionLocal() as db:
        assert db.query(AuditLog).filter(AuditLog.entite_id.in_(first['accepted'])).count() == audit_count
        assert db.query(SyncReceipt).filter(SyncReceipt.entity_id.in_(first['accepted'])).count() == 2
    # Approved civil records cannot be overwritten by the offline channel.
    assert c.post('/api/actes/' + acte['entity_id'] + '/valider', headers=admin).status_code == 200
    patch = record({'nom_concerne': 'Override'}, kind='acte', id=acte['entity_id'])
    assert push(c, local, patch)['results'][0]['code'] == 'record_locked'
    assert push(c, local, acte)['results'][0]['code'] == 'already_applied'


def test_mixed_batch_rejects_invalid_and_protected_data(sync_api):
    c, _, local, mid, _, _ = sync_api
    valid = record({'nom': 'Valide', 'prenom': 'Test', 'telephone': '0340000000'}, legacy=True)
    invalid = record({'nom': 'Sans téléphone', 'prenom': 'Test'})
    protected = record({'nom': 'Admin', 'prenom': 'Test', 'telephone': '0340000000', 'is_active': False})
    unsupported = record({'montant': 2000}, kind='transaction')
    corrupted = record({'nom': 'Corrompu', 'prenom': 'Test', 'telephone': '0340000000'})
    corrupted['hash'] = '0' * 64
    future = record(valid['data'], timestamp=stamp(datetime.utcnow() + timedelta(days=1)))
    r = push(c, local, invalid, valid, protected, unsupported, corrupted, future)
    assert r['accepted'] == [valid['entity_id']]
    assert [x['code'] for x in r['results']] == ['invalid_data', 'applied', 'protected_or_unknown_field',
                                               'unsupported_entity', 'invalid_hash', 'future_timestamp']
    with SessionLocal() as db:
        for bad in [invalid, protected, unsupported, corrupted, future]:
            assert db.get(Citoyen, bad['entity_id']) is None
            assert db.query(SyncReceipt).filter_by(entity_id=bad['entity_id']).count() == 0
    assert c.post('/api/sync/', headers=mid, json={'records': [valid]}).status_code == 403
    assert c.post('/api/sync/', headers=local, json={'records': [valid] * 201}).status_code == 422
    assert c.get('/api/sync/citoyen', headers=mid).status_code == 200


def test_lww_equal_timestamp_and_timezone(sync_api):
    c, _, local, _, _, _ = sync_api
    now = datetime.utcnow() - timedelta(minutes=1)
    original = record({'nom': 'Original', 'prenom': 'Test', 'telephone': '0340000000'}, timestamp=stamp(now))
    assert push(c, local, original)['accepted']
    older = record({'nom': 'Ancien'}, id=original['entity_id'], timestamp=stamp(now - timedelta(seconds=1)))
    collision = record({'nom': 'Conflit'}, id=original['entity_id'], timestamp=stamp(now))
    newer = record({'nom': 'Nouveau'}, id=original['entity_id'], timestamp=stamp(now + timedelta(seconds=1)))
    assert push(c, local, older)['results'][0]['code'] == 'server_newer'
    assert push(c, local, collision)['results'][0]['code'] == 'timestamp_collision'
    assert push(c, local, newer)['accepted'] == [original['entity_id']]
    offset = dict(newer, timestamp=(now + timedelta(seconds=1)).replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=3))).isoformat())
    assert push(c, local, offset)['results'][0]['code'] == 'already_applied'
    with SessionLocal() as db:
        assert db.get(Citoyen, original['entity_id']).nom == 'Nouveau'


def test_scope_foreign_keys_and_transfer(sync_api):
    c, admin, local, _, fok, foreign = sync_api
    outsider = record({'nom': 'Autre', 'prenom': 'Commune', 'telephone': '0340000000', 'fokontany_id': foreign})
    assert push(c, admin, outsider)['accepted']
    patch = record({'nom': 'Interdit'}, id=outsider['entity_id'])
    assert push(c, local, patch)['results'][0]['code'] == 'forbidden'
    own = record({'nom': 'Local', 'prenom': 'Test', 'telephone': '0340000000'})
    assert push(c, local, own)['accepted']
    transfer = record({'fokontany_id': foreign}, id=own['entity_id'])
    assert push(c, local, transfer)['results'][0]['code'] == 'forbidden'
    bad_link = record({'type_acte': 'Naissance', 'nom_concerne': 'Test', 'date_evenement': '2024-01-02',
                       'citoyen_id': str(uuid4())}, kind='acte')
    assert push(c, local, bad_link)['results'][0]['code'] == 'invalid_reference'
    linked = record({**bad_link['data'], 'citoyen_id': outsider['entity_id']}, kind='acte')
    assert push(c, local, linked)['results'][0]['code'] == 'forbidden'
    ids = [x['entity_id'] for x in c.get('/api/sync/citoyen', headers=local).json()['items']]
    assert own['entity_id'] in ids and outsider['entity_id'] not in ids


def test_pull_late_arrival_pagination_and_soft_delete(sync_api):
    c, admin, local, _, fok, _ = sync_api
    base = record({'nom': 'Curseur', 'prenom': 'Test', 'telephone': '0340000000'})
    push(c, local, base)
    with SessionLocal() as db:
        watermark = db.get(SyncClock, 1).value
    scope = c.get('/api/sync/citoyen', headers=local).json()['scope']
    late = record({'nom': 'Retard', 'prenom': 'Offline', 'telephone': '0340000000'},
                  timestamp=stamp(datetime.utcnow() - timedelta(days=30)))
    push(c, local, late)
    r = c.get('/api/sync/citoyen', headers=local,
              params={'version': watermark, 'scope': scope}).json()
    assert late['entity_id'] in [x['entity_id'] for x in r['items']]
    with SessionLocal() as db:
        for id in [base['entity_id'], late['entity_id']]: db.get(Citoyen, id).nom = 'Même version'
        db.get(Citoyen, late['entity_id']).is_active = False
        db.commit()
        marker = db.get(SyncClock, 1).value
    first = c.get('/api/sync/citoyen', headers=local, params={'version': marker, 'scope': scope,
                  'after_id': '00000000-0000-0000-0000-000000000000', 'limit': 1}).json()
    second = c.get('/api/sync/citoyen', headers=local, params={**first['cursor'], 'limit': 1}).json()
    assert first['has_more'] and not second['has_more']
    items = first['items'] + second['items']
    assert {x['entity_id'] for x in items} == {base['entity_id'], late['entity_id']}
    assert next(x for x in items if x['entity_id'] == late['entity_id'])['metadata']['is_active'] is False
    assert c.get('/api/sync/citoyen', headers=admin, params={'version': 'invalid'}).status_code == 422
    assert c.get('/api/sync/transaction', headers=admin).status_code == 422


def test_failed_commit_is_not_acknowledged(sync_api):
    from sqlalchemy.exc import OperationalError
    from app.core.config import get_db
    c, _, local, _, _, _ = sync_api
    candidate = record({'nom': 'Rollback', 'prenom': 'Test', 'telephone': '0340000000'})
    def fail_db():
        with SessionLocal() as db:
            def fail(): raise OperationalError('simulated failure', None, Exception())
            db.commit = fail
            yield db
    app.dependency_overrides[get_db] = fail_db
    try:
        response = push(c, local, candidate)
        assert response['accepted'] == [] and response['results'][0]['code'] == 'server_error'
    finally:
        app.dependency_overrides.pop(get_db)
    with SessionLocal() as db:
        assert db.get(Citoyen, candidate['entity_id']) is None
        assert db.query(SyncReceipt).filter_by(entity_id=candidate['entity_id']).count() == 0
        assert db.query(AuditLog).filter_by(entite_id=candidate['entity_id']).count() == 0


from test_migrations import database


def test_concurrent_duplicate_and_lww_updates(database):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy.orm import sessionmaker
    from app.schema import upgrade_database
    from app.models.models import Agent
    from app.core.security import hash_password
    from app.schemas.schemas import SyncRecord
    from app.services.sync_service import push_records
    upgrade_database(database)
    sessions = sessionmaker(bind=database)
    with sessions() as db:
        agent = Agent(matricule='SYNC-TEST', nom='Test', prenom='Admin', fokontany='Tous',
                      role='Administrateur', hashed_password=hash_password('test-password'))
        db.add(agent)
        db.commit()
        aid = agent.id
    initial_time = datetime.utcnow() - timedelta(minutes=1)
    candidate = record({'nom': 'Concurrent', 'prenom': 'Test', 'telephone': '0340000000'}, timestamp=stamp(initial_time))
    barrier = Barrier(2)
    def write(payload):
        with sessions() as db:
            agent = db.get(Agent, aid)
            barrier.wait(timeout=10)
            return push_records(db, agent, [SyncRecord(**payload)], 'test')
    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(write, [candidate, candidate]))
    assert all(r['accepted'] == [candidate['entity_id']] for r in results), results
    with sessions() as db:
        assert db.query(Citoyen).count() == db.query(SyncReceipt).count() == db.query(AuditLog).count() == 1
    older = record({'nom': 'Older'}, id=candidate['entity_id'], timestamp=stamp(initial_time + timedelta(seconds=1)))
    newer = record({'nom': 'Newer'}, id=candidate['entity_id'], timestamp=stamp(initial_time + timedelta(seconds=2)))
    barrier.reset()
    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(write, [older, newer]))
    assert not any(r['errors'] for r in results), results
    with sessions() as db:
        assert db.get(Citoyen, candidate['entity_id']).nom == 'Newer'


def test_transfer_tombstone_and_assignment_change(sync_api):
    from app.models.models import Agent
    c, admin, local, _, _, foreign = sync_api
    item = record({'nom': 'Transfert', 'prenom': 'Test', 'telephone': '0340000000'})
    assert push(c, local, item)['accepted']
    state = c.get('/api/sync/citoyen', headers=local, params={'limit': 200}).json()
    assert not state['has_more']
    moved = record({'fokontany_id': foreign}, id=item['entity_id'])
    assert push(c, admin, moved)['accepted']
    update = c.get('/api/sync/citoyen', headers=local, params=state['cursor']).json()
    removed = next(x for x in update['items'] if x['entity_id'] == item['entity_id'])
    assert removed['data'] is None and removed['metadata']['removed'] is True
    with SessionLocal() as db:
        operator = db.query(Agent).filter_by(matricule='AGT-0002').one()
        original = operator.fokontany
        operator.fokontany = db.get(Fokontany, foreign).nom
        db.commit()
    try:
        assert c.get('/api/sync/citoyen', headers=local, params=update['cursor']).status_code == 409
    finally:
        with SessionLocal() as db:
            db.query(Agent).filter_by(matricule='AGT-0002').one().fokontany = original
            db.commit()


def test_pull_cannot_skip_uncommitted_change(database):
    from sqlalchemy.orm import sessionmaker
    from app.schema import upgrade_database
    from app.models.models import Agent
    from app.services.sync_service import pull_records
    upgrade_database(database)
    sessions = sessionmaker(bind=database)
    with sessions() as db:
        agent = Agent(matricule='CURSOR-TEST', nom='Test', prenom='Admin', fokontany='Tous',
                      role='Administrateur', hashed_password='test-only')
        citizen = Citoyen(nom='Initial', prenom='Test', telephone='0340000000')
        db.add_all([agent, citizen])
        db.commit()
        aid, cid = agent.id, citizen.id
        initial = pull_records(db, agent, 'citoyen', None, None, None, 100)['cursor']
    with sessions() as writer:
        writer.get(Citoyen, cid).nom = 'Après commit'
        writer.flush()  # Writer holds the clock lock but has not committed.
        with sessions() as reader:
            before = pull_records(reader, reader.get(Agent, aid), 'citoyen', initial['version'],
                                  initial['after_id'], initial['scope'], 100)
            assert before['items'] == [] and before['cursor']['version'] == initial['version']
        writer.commit()
    with sessions() as reader:
        after = pull_records(reader, reader.get(Agent, aid), 'citoyen', before['cursor']['version'],
                             before['cursor']['after_id'], before['cursor']['scope'], 100)
        assert after['items'][0]['entity_id'] == cid
        assert after['items'][0]['data']['nom'] == 'Après commit'


def test_constraint_failure_does_not_poison_remaining_batch(sync_api):
    c, _, local, _, _, _ = sync_api
    cin = uuid4().hex[:12]
    data = {'nom': 'Unique', 'prenom': 'Test', 'telephone': '0340000000', 'cin': cin}
    first, duplicate = record(data), record(data)
    blank = record({**data, 'cin': ''})
    bad_date = record({'type_acte': 'Naissance', 'nom_concerne': 'Test', 'date_evenement': '2024'}, kind='acte')
    result = push(c, local, first, duplicate, blank, bad_date)
    assert result['accepted'] == [first['entity_id'], blank['entity_id']]
    assert result['results'][1]['code'] == 'integrity_error'
    assert result['results'][3]['code'] == 'invalid_data'
    with SessionLocal() as db:
        assert db.get(Citoyen, duplicate['entity_id']) is None
        assert db.get(Citoyen, blank['entity_id']).cin is None
