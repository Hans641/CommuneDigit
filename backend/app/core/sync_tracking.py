"""Transactional change feed shared by every ORM citizen/civil-record writer."""
from datetime import datetime
from uuid import uuid4
from sqlalchemy import event, select
from sqlalchemy.orm import Session


@event.listens_for(Session, 'before_flush')
def track_changes(session, flush_context, instances):
    from app.models.models import Citoyen, ActeEtatCivil, SyncClock, SyncChange
    tracked = [obj for obj in session.new | session.dirty | session.deleted
               if isinstance(obj, (Citoyen, ActeEtatCivil)) and
               (obj in session.new or obj in session.deleted or session.is_modified(obj, include_collections=False))]
    if not tracked:
        return
    connection = session.connection()
    clock = SyncClock.__table__
    # This lock is retained until commit. No lower feed version can commit later.
    connection.execute(clock.update().where(clock.c.id == 1).values(value=clock.c.value + 1))
    version = connection.execute(select(clock.c.value).where(clock.c.id == 1)).scalar_one()
    now = datetime.utcnow()
    for obj in tracked:
        if not obj.id:
            obj.id = str(uuid4())
        kind = 'citoyen' if isinstance(obj, Citoyen) else 'acte'
        old = None
        if obj not in session.new:
            old = connection.execute(select(obj.__table__.c.fokontany_id)
                                     .where(obj.__table__.c.id == obj.id)).scalar_one()
        new = None if obj in session.deleted else obj.fokontany_id
        if obj not in session.deleted:
            obj.sync_version, obj.sync_updated_at = version, now
        connection.execute(SyncChange.__table__.insert().values(
            version=version, entity_type=kind, entity_id=obj.id,
            old_fokontany_id=old, new_fokontany_id=new))
