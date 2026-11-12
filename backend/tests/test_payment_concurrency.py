"""PostgreSQL races using independent sessions and synchronized SQL statements."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, local

import pytest
from fastapi import HTTPException
from sqlalchemy import event, text
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

from test_migrations import database
from app.schema import upgrade_database
from app.models.models import (
    Agent, Citoyen, CompteCitoyen, CatalogueService, DemandeService,
    Transaction, PaiementDemande, EvenementDemande, Notification, AuditLog,
)
from app.routers.other_routers import create_transaction
from app.routers.citoyen_space import payer_demande, PaiementConfirm
from app.schemas.schemas import TransactionCreate


@pytest.fixture
def payments(database):
    if database.dialect.name != 'postgresql':
        pytest.skip('Row-lock payment races require PostgreSQL; set MIGRATION_TEST_POSTGRES_URL')
    upgrade_database(database)
    sessions = sessionmaker(bind=database, expire_on_commit=False)
    with sessions() as db:
        citizen = Citoyen(nom='Race', prenom='Test', telephone='0340000000')
        agent = Agent(matricule='RACE-ADMIN', nom='Race', prenom='Admin', role='Administrateur',
                      fokontany='Tous', hashed_password='test-only')
        service = CatalogueService(code='RACE', nom='Race', categorie='Certificat', prix_ar=2000)
        db.add_all([citizen, agent, service])
        db.flush()
        account = CompteCitoyen(email='race@example.com', hashed_password='test-only', citoyen_id=citizen.id)
        db.add(account)
        db.flush()
        demands = [DemandeService(reference='RACE-' + str(i), compte_id=account.id, citoyen_id=citizen.id,
                                 service_code='RACE', montant_ar=2000, statut='Soumise') for i in range(2)]
        db.add_all(demands)
        db.commit()
        ids = dict(agent=agent.id, account=account.id, citizen=citizen.id, demands=[d.id for d in demands])
    return database, sessions, ids


def race(engine, jobs, *, statement, after=False):
    """Force both requests past the same read (or up to the same row lock)."""
    barrier = Barrier(2)
    state = local()
    hits = []

    def synchronize(connection, cursor, sql, parameters, context, executemany):
        if not getattr(state, 'synchronized', False) and statement(sql):
            state.synchronized = True
            hits.append(True)
            barrier.wait(timeout=10)

    hook = 'after_cursor_execute' if after else 'before_cursor_execute'
    event.listen(engine, hook, synchronize)
    try:
        with ThreadPoolExecutor(max_workers=2) as workers:
            futures = [workers.submit(job) for job in jobs]
            results = [f.result(timeout=25) for f in futures]
    finally:
        event.remove(engine, hook, synchronize)
    assert len(hits) == 2, 'Both SQL operations must reach the contention point'
    return results


def record_job(sessions, ids, amount):
    def run():
        with sessions() as db:
            db.execute(text("SET LOCAL statement_timeout = '15s'"))
            try:
                txn = create_transaction(
                    TransactionCreate(citoyen_id=ids['citizen'], montant=amount, type_paiement='Manuel',
                                      idempotency_key='race-idempotency-key', reference_externe='receipt'),
                    Request({'type': 'http', 'client': ('127.0.0.1', 1234), 'headers': []}),
                    db, db.get(Agent, ids['agent']))
                return 201, txn.id
            except HTTPException as exc:
                return exc.status_code, None
    return run


@pytest.mark.parametrize('amounts', [(2000, 2000), (2000, 3000)])
def test_concurrent_register_idempotency(payments, amounts):
    engine, sessions, ids = payments
    results = race(engine, [record_job(sessions, ids, amount) for amount in amounts], after=True,
                   statement=lambda sql: sql.lstrip().startswith('SELECT') and
                   'WHERE transactions.idempotency_key =' in sql)
    assert sorted(code for code, _ in results) == ([201, 201] if amounts[0] == amounts[1] else [201, 409])
    if amounts[0] == amounts[1]:
        assert results[0][1] == results[1][1]
    with sessions() as db:
        assert db.query(Transaction).count() == db.query(AuditLog).count() == 1
        txn, audit = db.query(Transaction).one(), db.query(AuditLog).one()
        assert audit.entite_id == txn.id and audit.agent_id == ids['agent']
        assert txn.montant in amounts


def pay_job(sessions, ids, demand, reference):
    def run():
        with sessions() as db:
            db.execute(text("SET LOCAL statement_timeout = '15s'"))
            try:
                payer_demande(demand, PaiementConfirm(reference_paiement=reference),
                              db.get(CompteCitoyen, ids['account']), db)
                return 200
            except HTTPException as exc:
                return exc.status_code
    return run


@pytest.mark.parametrize('scenario', ['same-payment', 'shared-transaction', 'competing-transactions'])
def test_concurrent_payment_matching(payments, scenario):
    engine, sessions, ids = payments
    with sessions() as db:
        transactions = [Transaction(reference='RACE-TXN-' + str(i), citoyen_id=ids['citizen'],
                                    agent_id=ids['agent'], type_paiement='Manuel', montant=2000,
                                    statut='Confirmé', idempotency_key='transaction-' + str(i)) for i in range(2)]
        db.add_all(transactions)
        db.commit()
        refs = [t.reference for t in transactions]
    first = (ids['demands'][0], refs[0])
    second = (ids['demands'][1] if scenario == 'shared-transaction' else ids['demands'][0],
              refs[1] if scenario == 'competing-transactions' else refs[0])
    results = race(engine, [pay_job(sessions, ids, *item) for item in (first, second)],
                   statement=lambda sql: 'FROM demandes_service' in sql and 'FOR UPDATE' in sql)
    assert sorted(results) == ([200, 200] if scenario == 'same-payment' else [200, 409])
    with sessions() as db:
        payment = db.query(PaiementDemande).one()
        demand = db.get(DemandeService, payment.demande_id)
        txn = db.get(Transaction, payment.transaction_id)
        assert demand.statut_paiement == 'Payé'
        assert demand.reference_paiement == txn.reference
        assert txn.citoyen_id == demand.citoyen_id and txn.montant == demand.montant_ar
        assert db.query(DemandeService).filter_by(statut_paiement='Payé').count() == 1
        assert db.query(EvenementDemande).filter_by(type_event='PAIEMENT').count() == 1
        assert db.query(Notification).count() == 1
        assert db.query(Transaction).count() == 2
