import os
import tempfile
from pathlib import Path

STATE = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(STATE.name) / 'test.db')
os.environ['UPLOAD_DIR'] = str(Path(STATE.name) / 'uploads')
os.environ['DOCUMENTS_DIR'] = str(Path(STATE.name) / 'documents')

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import SessionLocal
from app.core.security import create_access_token
from app.models.models import CatalogueService
from app.services.file_service import FileService
from app.services.document_service import DocumentGenerationService


def register(c, email):
    r = c.post('/api/espace-citoyen/inscription', json=dict(
        email=email, password='password123', nom='<script>alert(1)</script>',
        prenom='Test', telephone='0340000000'))
    assert r.status_code == 201, r.text
    return {'Authorization': 'Bearer ' + r.json()['access_token']}


def test_citizen_workflow():
    with TestClient(app) as c:
        with SessionLocal() as db:
            db.add(CatalogueService(code='TEST', nom='Test document', categorie='Certificat', prix_ar=0,
                                    documents_requis=[{'code': 'CIN', 'label': 'CIN', 'obligatoire': True}]))
            db.commit()
        h = register(c, 'citizen@example.com')
        other = register(c, 'other@example.com')
        assert c.get('/api/auth/me', headers=h).status_code == 401
        assert c.post('/api/espace-citoyen/inscription', json=dict(
            email='CITIZEN@example.com', password='password123', nom='A', prenom='B', telephone='0340000000')).status_code == 400
        r = c.post('/api/espace-citoyen/upload', headers=h,
                   data={'demande_id': '../../escape'}, files={'file': ('cin.pdf', b'%PDF-1.4 test', 'application/pdf')})
        assert r.status_code == 201, r.text
        upload = r.json()
        assert c.get('/api/espace-citoyen/fichier/' + upload['id'], headers=h).content == b'%PDF-1.4 test'
        assert c.get('/api/espace-citoyen/fichier/' + upload['id'], headers=other).status_code == 404
        body = {'service_code': 'TEST', 'pieces_jointes': [{'type': 'CIN', 'url': upload['url']}]}
        assert c.post('/api/espace-citoyen/demandes', headers=other, json=body).status_code == 422
        r = c.post('/api/espace-citoyen/demandes', headers=h, json=body)
        assert r.status_code == 201, r.text
        notifications = c.get('/api/espace-citoyen/notifications', headers=h).json()
        assert len(notifications) == 1
        assert 'Test document' in notifications[0]['message']
        demande = c.get('/api/espace-citoyen/demandes', headers=h).json()[0]
        assert c.delete('/api/espace-citoyen/upload/' + upload['id'], headers=h).status_code == 409
        path = '/api/espace-citoyen/demandes/' + demande['id']
        assert c.post(path + '/generer-document', headers=h).status_code == 400
        agent = c.post('/api/auth/login', json={'username': 'AGT-0001', 'password': 'admin123'}).json()
        ah = {'Authorization': 'Bearer ' + agent['access_token']}
        piece_path = '/api/demandes-citoyens/' + demande['id'] + '/pieces/0'
        assert c.get(piece_path, headers=ah).content == b'%PDF-1.4 test'
        assert c.get(piece_path, headers=h).status_code == 401
        assert c.get(piece_path).status_code == 401
        assert c.get(piece_path[:-1] + '99', headers=ah).status_code == 404
        assert c.patch('/api/demandes-citoyens/' + demande['id'], headers=ah, json={'statut': 'En traitement'}).status_code == 200
        r = c.patch('/api/demandes-citoyens/' + demande['id'], headers=ah, json={'statut': 'Approuvée'})
        assert r.status_code == 200, r.text
        history = c.get(path + '/historique', headers=h).json()
        assert [e['type_event'] for e in history] == ['SOUMISSION', 'TRANSITION_STATUT', 'TRANSITION_STATUT']
        assert c.get(path + '/historique', headers=other).status_code == 404
        r = c.post(path + '/generer-document', headers=h)
        assert r.status_code == 201, r.text
        doc = c.get(path + '/document', headers=h)
        assert doc.status_code == 200, doc.text
        assert '&lt;script&gt;' in doc.text.lower() and '<script>' not in doc.text.lower()
        assert c.get(path + '/document', headers=other).status_code == 404
        assert c.get(r.json()['url']).status_code == 404
        assert c.post('/api/espace-citoyen/demandes', headers=h, json=body).status_code == 422
        # Unlinked uploads can be removed from both database and disk.
        r = c.post('/api/espace-citoyen/upload', headers=h, data={'demande_id': 'draft'},
                   files={'file': ('scan.pdf', b'pdf', 'application/pdf')})
        u = r.json()
        assert c.delete('/api/espace-citoyen/upload/' + u['id'], headers=h).status_code == 200
        assert FileService.get_file_path(u['url']) is None


def test_invalid_token_subject():
    with TestClient(app) as c:
        for kind, path in [('citoyen', '/api/espace-citoyen/profil'), (None, '/api/auth/me')]:
            payload = {'sub': 'invalid'}
            if kind:
                payload['type'] = kind
            h = {'Authorization': 'Bearer ' + create_access_token(payload)}
            assert c.get(path, headers=h).status_code == 401


def test_path_resolution():
    for service, prefix in [(FileService.get_file_path, 'uploads'),
                            (DocumentGenerationService.get_document_file, 'documents')]:
        assert service('/' + prefix + '/../../etc/passwd') is None
        assert service('/etc/passwd') is None


def test_request_policy_and_payment(monkeypatch):
    from app.models.models import CompteCitoyen, Fokontany
    with TestClient(app) as c:
        def agent(user, pwd):
            r = c.post('/api/auth/login', json={'username': user, 'password': pwd})
            assert r.status_code == 200
            return {'Authorization': 'Bearer ' + r.json()['access_token']}
        admin = agent('AGT-0001', 'admin123')
        operator = agent('AGT-0002', 'agent123')
        mid = agent('AGT-0003', 'mid2024')
        h = register(c, 'payer@example.com')
        other = register(c, 'outside@example.com')
        with SessionLocal() as db:
            db.add(CatalogueService(code='PAID', nom='Payant', categorie='Certificat', prix_ar=2000, documents_requis=[]))
            account = db.query(CompteCitoyen).filter_by(email='payer@example.com').one()
            citizen_id = account.citoyen_id
            account.citoyen.fokontany_id = db.query(Fokontany).filter_by(nom='Sabotsy Namehana').one().id
            db.commit()
        def request(headers):
            assert c.post('/api/espace-citoyen/demandes', headers=headers, json={'service_code': 'PAID'}).status_code == 201
            return c.get('/api/espace-citoyen/demandes', headers=headers).json()[0]['id']
        did, foreign = request(h), request(other)
        path = '/api/demandes-citoyens/' + did
        cp = '/api/espace-citoyen/demandes/' + did
        def transition(status, headers=admin):
            return c.patch(path, headers=headers, json={'statut': status})
        assert transition('Prête').status_code == 409
        assert transition('En traitement', mid).status_code == 403
        assert c.patch('/api/demandes-citoyens/' + foreign, headers=operator, json={'statut': 'En traitement'}).status_code == 404
        listed = c.get('/api/demandes-citoyens/', headers=operator).json()
        assert did in [d['id'] for d in listed] and foreign not in [d['id'] for d in listed]
        assert c.get('/api/demandes-citoyens/stats', headers=operator).json()['total'] == len(listed)
        assert transition('En traitement', operator).status_code == 200
        assert transition('Approuvée', operator).status_code == 403
        assert transition('Approuvée').status_code == 200
        assert transition('Prête').status_code == 409
        assert c.post(cp + '/generer-document', headers=h).status_code == 409
        def pay(ref, url=cp, headers=h):
            return c.post(url + '/payer', headers=headers, json={'reference_paiement': ref})
        assert pay('invented').status_code == 409
        body = {'citoyen_id': citizen_id, 'type_paiement': 'Manuel', 'montant': 2000,
                'idempotency_key': 'payment-policy-1', 'reference_externe': 'receipt-1'}
        for headers in [operator, mid]:
            assert c.post('/api/transactions/', headers=headers, json=body).status_code == 403
        r = c.post('/api/transactions/', headers=admin, json=body)
        assert r.status_code == 201, r.text
        ref = r.json()['reference']
        assert c.post('/api/transactions/', headers=admin, json=body).json()['id'] == r.json()['id']
        assert c.post('/api/transactions/', headers=admin, json={**body, 'montant': 3000}).status_code == 409
        assert pay(ref, '/api/espace-citoyen/demandes/' + foreign, other).status_code == 409
        assert pay(ref).status_code == 200
        assert pay(ref).status_code == 200
        second = request(h)
        assert pay(ref, '/api/espace-citoyen/demandes/' + second).status_code == 409
        with monkeypatch.context() as patch:
            patch.setattr(DocumentGenerationService, 'create_or_update_document', lambda *a, **kw: None)
            assert transition('Prête').status_code == 500
        assert c.get(cp, headers=h).json()['statut'] == 'Approuvée'
        assert not any(e['nouveau_statut'] == 'Prête' for e in c.get(cp + '/historique', headers=h).json())
        assert transition('Prête').status_code == 200
        assert c.get(cp + '/document', headers=h).status_code == 200
        assert transition('En traitement').status_code == 409
        count = len(c.get(cp + '/historique', headers=h).json())
        assert transition('Prête').status_code == 200
        assert len(c.get(cp + '/historique', headers=h).json()) == count


def test_supervisor_rejection_and_notification_rollback(monkeypatch):
    from app.models.models import Agent
    from app.core.security import hash_password
    from app.services.notification_service import NotificationService
    with TestClient(app) as c:
        with SessionLocal() as db:
            db.add(CatalogueService(code='REJECT_TEST', nom='Rejet', categorie='Certificat', prix_ar=2000, documents_requis=[]))
            db.add(Agent(matricule='SUP-TEST', nom='Test', prenom='Supervisor',
                         role='Superviseur', fokontany='Tous', hashed_password=hash_password('supervisor123')))
            db.commit()
        token = c.post('/api/auth/login', json={'username': 'SUP-TEST', 'password': 'supervisor123'}).json()['access_token']
        supervisor = {'Authorization': 'Bearer ' + token}
        h = register(c, 'reject@example.com')
        assert c.post('/api/espace-citoyen/demandes', headers=h, json={'service_code': 'REJECT_TEST'}).status_code == 201
        did = c.get('/api/espace-citoyen/demandes', headers=h).json()[0]['id']
        path = '/api/demandes-citoyens/' + did
        def fail(*args, **kwargs):
            raise RuntimeError('Notification unavailable')
        with monkeypatch.context() as patch:
            patch.setattr(NotificationService, 'create_notification', fail)
            assert c.patch(path, headers=supervisor, json={'statut': 'Rejetée'}).status_code == 500
        detail = '/api/espace-citoyen/demandes/' + did
        assert c.get(detail, headers=h).json()['statut'] == 'Soumise'
        assert len(c.get(detail + '/historique', headers=h).json()) == 1
        assert c.patch(path, headers=supervisor, json={'statut': 'Rejetée', 'note_agent': 'Pièce illisible'}).status_code == 200
        assert c.patch(path, headers=supervisor, json={'statut': 'En traitement'}).status_code == 409
        assert c.post(detail + '/payer', headers=h, json={'reference_paiement': 'fake'}).status_code == 409
        assert c.post('/api/agents/', headers=supervisor, json={}).status_code == 403
