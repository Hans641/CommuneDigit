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


@pytest.mark.parametrize('extras', [set(), {'fichiers_citoyens'}, {'fichiers_citoyens', 'paiements_demandes'}])
def test_adopt_existing_snapshots_preserves_data(database, extras):
    metadata = MetaData()
    for table in Base.metadata.sorted_tables:
        if table.name not in ADDITIONS or table.name in extras:
            table.to_metadata(metadata)
    metadata.create_all(database)  # reproduce historical, unversioned installations
    sentinel(database)
    adopt_database(database)
    require_current(database)
    assert_sentinel(database)
    with database.begin() as connection:
        command.check(config(connection))
    with pytest.raises(RuntimeError, match='déjà versionnée'):
        adopt_database(database)


def test_adoption_rejects_drift_without_stamping(database):
    Base.metadata.create_all(database, tables=[t for t in Base.metadata.sorted_tables if t.name not in {'password_resets', 'password_reset_limits'}])
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
