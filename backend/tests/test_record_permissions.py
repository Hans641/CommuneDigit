"""Role and territorial regression coverage for the legacy record endpoints."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from test_citizen_workflow import app, SessionLocal
from app.models.models import Agent, Citoyen, Fokontany
from app.core.security import create_access_token


@pytest.fixture
def api():
    with TestClient(app) as client:
        with SessionLocal() as db:
            local = db.query(Fokontany).filter_by(nom='Sabotsy Namehana').one().id
            foreign = db.query(Fokontany).filter(Fokontany.id != local).first().id
            headers = {}
            for role in ('Administrateur', 'Superviseur', 'Ministère MID', 'Agent Fokontany'):
                agent = Agent(matricule=uuid4().hex[:20], nom='Permissions', prenom='Test',
                              role=role, fokontany='Sabotsy Namehana', hashed_password='unused')
                db.add(agent)
                db.flush()
                headers[role] = {'Authorization': 'Bearer ' + create_access_token({'sub': str(agent.id)})}
            citizens = []
            for territory in (local, foreign, None):
                citizen = Citoyen(nom='Permissions', prenom='Test', telephone='0340000000', fokontany_id=territory)
                db.add(citizen)
                db.flush()
                citizens.append(citizen.id)
            db.commit()
        yield client, headers, local, foreign, citizens


def create_record(client, headers, kind, citizen, territory):
    if kind == 'actes':
        body = dict(type_acte='Naissance', nom_concerne='Permissions',
                    date_evenement='2024-01-01T00:00:00', citoyen_id=citizen, fokontany_id=territory)
    else:
        body = dict(type_cert='Résidence', citoyen_id=citizen)
    response = client.post('/api/' + kind + '/', headers=headers, json=body)
    assert response.status_code == 201, response.text
    return response.json()['id']


@pytest.mark.parametrize('kind', ['citoyens', 'actes', 'certificats'])
def test_lists_mutations_and_ministry_read_only(api, kind):
    c, h, local, foreign, citizens = api
    admin, operator, ministry = [h[r] for r in ('Administrateur', 'Agent Fokontany', 'Ministère MID')]
    ids = citizens if kind == 'citoyens' else [
        create_record(c, admin, kind, citizen, territory)
        for citizen, territory in zip(citizens, (local, foreign, None))]
    path = '/api/' + kind
    listed = {row['id'] for row in c.get(path + '/', headers=operator).json()}
    assert ids[0] in listed and ids[1] not in listed and ids[2] not in listed
    for role in ('Administrateur', 'Superviseur', 'Ministère MID'):
        listed = {row['id'] for row in c.get(path + '/?limit=200', headers=h[role]).json()}
        assert set(ids) <= listed
    for id in ids[1:]:
        assert c.patch(path + '/' + id, headers=operator, json={}).status_code == 404
    for id in ids:
        assert c.patch(path + '/' + id, headers=ministry, json={}).status_code == 403
    assert c.patch(path + '/' + ids[0], headers=operator, json={}).status_code == 200
    if kind != 'certificats':
        assert c.get(path + '/' + ids[0], headers=operator).status_code == 200
        assert c.get(path + '/' + ids[1], headers=operator).status_code == 404
    if kind == 'citoyens':
        assert c.delete(path + '/' + ids[0], headers=ministry).status_code == 403
        assert c.delete(path + '/' + ids[1], headers=operator).status_code == 404
        assert c.delete(path + '/' + ids[0], headers=operator).status_code == 204
    else:
        action = 'valider' if kind == 'actes' else 'delivrer'
        assert c.post(path + '/' + ids[0] + '/' + action, headers=operator).status_code == 403
        assert c.post(path + '/' + ids[0] + '/' + action, headers=ministry).status_code == 403
        assert c.post(path + '/' + ids[0] + '/' + action, headers=h['Superviseur']).status_code == 200


def test_creation_and_reassignment_scope(api):
    c, h, local, foreign, citizens = api
    operator = h['Agent Fokontany']
    body = dict(nom='New', prenom='Test', telephone='0340000000')
    r = c.post('/api/citoyens/', headers=operator, json=body)
    assert r.status_code == 201
    assert r.json()['fokontany_id'] == local
    id = r.json()['id']
    assert c.post('/api/citoyens/', headers=operator, json={**body, 'fokontany_id': foreign}).status_code == 403
    assert c.patch('/api/citoyens/' + id, headers=operator, json={'fokontany_id': foreign}).status_code == 403
    assert c.post('/api/citoyens/', headers=h['Ministère MID'], json=body).status_code == 403
    for kind in ('actes', 'certificats'):
        create_record(c, operator, kind, citizens[0], local)
        body = (dict(type_acte='Naissance', nom_concerne='Test', date_evenement='2024-01-01',
                     citoyen_id=citizens[1], fokontany_id=local)
                if kind == 'actes' else dict(type_cert='Résidence', citoyen_id=citizens[1]))
        assert c.post('/api/' + kind + '/', headers=operator, json=body).status_code == 404
        assert c.post('/api/' + kind + '/', headers=h['Ministère MID'], json=body).status_code == 403
    assert c.post('/api/actes/', headers=h['Administrateur'], json=dict(
        type_acte='Naissance', nom_concerne='Test', date_evenement='2024-01-01',
        citoyen_id=citizens[1], fokontany_id=local)).status_code == 422
    assert c.post('/api/certificats/', headers=operator,
                  json={'type_cert': 'Résidence'}).status_code == 422
    assert c.get('/api/citoyens/?fokontany_id=' + str(foreign), headers=operator).json() == []
    with SessionLocal() as db:
        assert db.get(Citoyen, id).fokontany_id == local
    assert c.patch('/api/citoyens/' + id, headers=h['Administrateur'], json={'fokontany_id': foreign}).status_code == 200
    assert c.get('/api/citoyens/' + id, headers=operator).status_code == 404


def test_unassigned_agent_is_denied_and_stats_are_scoped(api):
    c, h, local, foreign, citizens = api
    for territory, citizen in zip((local, foreign), citizens):
        create_record(c, h['Administrateur'], 'actes', citizen, territory)
    stats = c.get('/api/actes/stats/summary', headers=h['Agent Fokontany'])
    assert stats.status_code == 200
    listed = c.get('/api/actes/', headers=h['Agent Fokontany']).json()
    assert sum(sum(statuses.values()) for statuses in stats.json().values()) == len(listed)
    with SessionLocal() as db:
        agent = db.query(Agent).filter_by(role='Agent Fokontany', nom='Permissions').order_by(Agent.id.desc()).first()
        agent.fokontany = 'Unassigned'
        db.commit()
    for kind in ('citoyens', 'actes', 'certificats'):
        assert c.get('/api/' + kind + '/', headers=h['Agent Fokontany']).status_code == 403


def test_ambiguous_assignment_grants_no_access(api):
    c, h, local, foreign, citizens = api
    with SessionLocal() as db:
        db.add(Fokontany(nom='Sabotsy Namehana', commune='Other commune'))
        db.commit()
    try:
        for kind in ('citoyens', 'actes', 'certificats'):
            assert c.get('/api/' + kind + '/', headers=h['Agent Fokontany']).status_code == 403
    finally:
        with SessionLocal() as db:
            duplicate = db.query(Fokontany).filter_by(nom='Sabotsy Namehana', commune='Other commune').one()
            db.delete(duplicate)
            db.commit()
