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
        r = c.patch('/api/demandes-citoyens/' + demande['id'], headers=ah, json={'statut': 'Approuvée'})
        assert r.status_code == 200, r.text
        history = c.get(path + '/historique', headers=h).json()
        assert [e['type_event'] for e in history] == ['SOUMISSION', 'TRANSITION_STATUT']
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
