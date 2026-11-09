"""Migrate disposable databases; PostgreSQL is opt-in via a dedicated test URL."""
import os
import uuid
import pytest
from alembic import command
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, MetaData, inspect, text, event
from app.core.config import Base
from app.schema import ADDITIONS, config, upgrade_database, adopt_database, require_current

TARGETS = ['sqlite'] + (['postgresql'] if os.environ.get('MIGRATION_TEST_POSTGRES_URL') else [])


@pytest.fixture(params=TARGETS)
def database(request, tmp_path):
    if request.param == 'sqlite':
        engine = create_engine('sqlite:///' + str(tmp_path / 'migration.db'))
        @event.listens_for(engine, 'connect')
        def foreign_keys(dbapi_connection, _):
            dbapi_connection.execute('PRAGMA foreign_keys=ON')
        yield engine
        engine.dispose()
    else:
        admin = create_engine(os.environ['MIGRATION_TEST_POSTGRES_URL'])
        schema = 'migration_test_' + uuid.uuid4().hex
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA {schema}'))
        engine = create_engine(os.environ['MIGRATION_TEST_POSTGRES_URL'],
                               connect_args={'options': f'-csearch_path={schema}'})
        try:
            yield engine
        finally:
            engine.dispose()
            with admin.begin() as connection:
                connection.execute(text(f'DROP SCHEMA {schema} CASCADE'))
            admin.dispose()


def sentinel(engine):
    with engine.begin() as connection:
        connection.execute(Base.metadata.tables['fokontany'].insert().values(nom='Conserver', commune='Test'))


def assert_sentinel(engine):
    with engine.connect() as connection:
        assert connection.execute(text("SELECT nom FROM fokontany WHERE nom='Conserver'")).scalar_one() == 'Conserver'


def test_fresh_upgrade_repeat_and_downgrade(database):
    with pytest.raises(RuntimeError, match='Schéma non à jour'):
        require_current(database)
    upgrade_database(database)
    require_current(database)
    with database.begin() as connection:
        command.check(config(connection))
    sentinel(database)
    upgrade_database(database)
    assert_sentinel(database)
    with database.begin() as connection:
        command.downgrade(config(connection), 'base')
    assert set(inspect(database).get_table_names()) <= {'alembic_version'}
    # PostgreSQL enum types must be removed too, so a clean re-upgrade works.
    upgrade_database(database)
    require_current(database)


@pytest.mark.parametrize('extras', [set(), {'fichiers_citoyens'}, {'fichiers_citoyens', 'paiements_demandes'}, {'fichiers_citoyens', 'paiements_demandes', 'password_resets', 'password_reset_limits'}])
def test_adopt_existing_snapshots_preserves_data(database, extras):
    revision = '0001' if not extras else ('0002' if extras == {'fichiers_citoyens'} else ('0004' if 'password_resets' in extras else '0003'))
    with database.begin() as connection:
        command.upgrade(config(connection), revision)
        connection.execute(text('DROP TABLE alembic_version'))
    sentinel(database)
    adopt_database(database)
    require_current(database)
    assert_sentinel(database)
    with database.begin() as connection:
        command.check(config(connection))
    with pytest.raises(RuntimeError, match='déjà versionnée'):
        adopt_database(database)


def test_adoption_rejects_drift_without_stamping(database):
    with database.begin() as connection:
        command.upgrade(config(connection), '0003')
        connection.execute(text('DROP TABLE alembic_version'))
    sentinel(database)
    with database.begin() as connection:
        connection.execute(text('ALTER TABLE fokontany ADD COLUMN unexpected INTEGER'))
    with pytest.raises(RuntimeError, match='Schéma incompatible'):
        adopt_database(database)
    with database.connect() as connection:
        assert not MigrationContext.configure(connection).get_current_heads()
    assert_sentinel(database)


def test_adoption_rejects_incomplete_database(database):
    with database.begin() as connection:
        connection.execute(text('CREATE TABLE unknown_table (id INTEGER PRIMARY KEY)'))
    with pytest.raises(RuntimeError, match='Schéma non reconnu'):
        adopt_database(database)
    assert inspect(database).get_table_names() == ['unknown_table']


def test_api_refuses_unversioned_database(database, monkeypatch):
    import importlib
    from fastapi.testclient import TestClient
    main = importlib.import_module('app.main')
    monkeypatch.setattr(main, 'engine', database)
    with pytest.raises(RuntimeError, match='Schéma non à jour'):
        with TestClient(main.app):
            pass
    assert inspect(database).get_table_names() == []


def test_sync_upgrade_backfill_and_safe_column_rollback(database):
    from sqlalchemy import Table
    from datetime import datetime
    from uuid import uuid4
    with database.begin() as connection:
        command.upgrade(config(connection), '0004')
        metadata = MetaData()
        citizen_table = Table('citoyens', metadata, autoload_with=connection)
        account_table = Table('comptes_citoyens', metadata, autoload_with=connection)
        acte_table = Table('actes_etat_civil', metadata, autoload_with=connection)
        cid, aid = str(uuid4()), str(uuid4())
        connection.execute(citizen_table.insert().values(id=cid, nom='Conserver', prenom='Migration',
                           telephone='0340000000', is_active=True, last_update=datetime.utcnow()))
        connection.execute(account_table.insert().values(email='migration@example.com', citoyen_id=cid,
                           hashed_password='test-only', is_active=True))
        connection.execute(acte_table.insert().values(id=aid, reference='MIGRATION-TEST', type_acte='Naissance',
                           nom_concerne='Conserver', date_evenement=datetime(2024, 1, 1), citoyen_id=cid,
                           statut='En attente', is_validated=False))
    upgrade_database(database)
    with database.begin() as connection:
        assert connection.execute(text('SELECT COUNT(*) FROM sync_changes')).scalar_one() == 2
        assert connection.execute(text('SELECT COUNT(*) FROM citoyens WHERE sync_updated_at IS NOT NULL')).scalar_one() == 1
        command.downgrade(config(connection), '0004')
        assert connection.execute(text('SELECT nom FROM citoyens')).scalar_one() == 'Conserver'
        assert connection.execute(text('SELECT citoyen_id FROM comptes_citoyens')).scalar_one() == cid
        assert connection.execute(text('SELECT citoyen_id FROM actes_etat_civil')).scalar_one() == cid
    upgrade_database(database)
    require_current(database)
    with database.begin() as connection:
        command.check(config(connection))
