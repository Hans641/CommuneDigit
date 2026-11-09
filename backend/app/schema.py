"""Versioned schema management. Run from backend: python -m app.schema adopt."""
from pathlib import Path
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from sqlalchemy import MetaData, inspect
from app.core.config import Base, engine
from app.models import models  # register metadata

BACKEND = Path(__file__).resolve().parents[1]
ADDITIONS = {'fichiers_citoyens', 'paiements_demandes'}


def config(connection=None):
    cfg = Config(str(BACKEND / 'alembic.ini'))
    if connection is not None:
        cfg.attributes['connection'] = connection
    return cfg


def require_current(db_engine=engine):
    with db_engine.connect() as connection:
        current = set(MigrationContext.configure(connection).get_current_heads())
    expected = set(ScriptDirectory.from_config(config()).get_heads())
    if current != expected:
        raise RuntimeError('Schéma non à jour : exécutez alembic upgrade head ; pour une base existante non versionnée, sauvegardez puis exécutez python -m app.schema adopt')


def upgrade_database(db_engine=engine):
    with db_engine.begin() as connection:
        command.upgrade(config(connection), 'head')


def adopt_database(db_engine=engine):
    """Recognize only supported create_all snapshots; validate before stamping."""
    with db_engine.begin() as connection:
        inspector = inspect(connection)
        if MigrationContext.configure(connection).get_current_heads():
            raise RuntimeError('Base déjà versionnée : utilisez alembic upgrade head')
        tables = set(inspector.get_table_names()) - {'alembic_version'}
        baseline = set(Base.metadata.tables) - ADDITIONS
        revisions = {
            frozenset(baseline): '0001',
            frozenset(baseline | {'fichiers_citoyens'}): '0002',
            frozenset(Base.metadata.tables): '0003',
        }
        revision = revisions.get(frozenset(tables))
        if not revision:
            raise RuntimeError('Schéma non reconnu : aucune version enregistrée ; vérifier les tables avant adoption')
        expected = MetaData()
        for table in Base.metadata.sorted_tables:
            if table.name in tables:
                table.to_metadata(expected)
        diffs = compare_metadata(MigrationContext.configure(connection, opts={'compare_type': True, 'compare_server_default': True}), expected)
        # Alembic does not reliably detect primary-key or native enum changes.
        for name, table in expected.tables.items():
            actual_pk = inspector.get_pk_constraint(name).get('constrained_columns') or []
            if actual_pk != [column.name for column in table.primary_key.columns]:
                diffs.append(('primary_key', name))
            actual_columns = {column['name']: column for column in inspector.get_columns(name)}
            for column in table.columns:
                actual = actual_columns.get(column.name)
                if actual and hasattr(actual['type'], 'enums') and hasattr(column.type, 'enums'):
                    if actual['type'].enums != column.type.enums:
                        diffs.append(('enum', name, column.name))
        if diffs:
            raise RuntimeError('Schéma incompatible : colonnes, types, index ou contraintes différents ; aucune version enregistrée')
        command.stamp(config(connection), revision)
        command.upgrade(config(connection), 'head')


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['adopt', 'check'])
    args = parser.parse_args()
    try:
        if args.action == 'adopt':
            adopt_database()
        require_current()
    except RuntimeError as exc:
        raise SystemExit(str(exc))
    print('Schéma Alembic à jour')


if __name__ == '__main__':
    main()
