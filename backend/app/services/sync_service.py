"""Authorized push/pull with durable receipts, UTC LWW and server-side cursors."""
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, ValidationError, StrictInt, field_validator
from fastapi import HTTPException
from sqlalchemy import or_, and_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError
from app.models.models import Agent, Citoyen, ActeEtatCivil, Fokontany, SyncReceipt, SyncClock, SyncChange
from app.core.security import hash_record, acte_integrity_hash
from app.services.audit_service import log_action
from app.services.ref_service import gen_reference
from app.services.request_policy import READERS

logger = logging.getLogger(__name__)


class CitizenData(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    nom: str = Field(..., min_length=1, max_length=100)
    prenom: str = Field(..., min_length=1, max_length=200)
    telephone: str = Field(..., min_length=8, max_length=20)
    cin: str | None = Field(None, max_length=30)
    @field_validator('cin', mode='before')
    @classmethod
    def empty_cin(cls, value):
        return None if isinstance(value, str) and not value.strip() else value

    adresse: str | None = None
    fokontany_id: StrictInt | None = Field(None, gt=0)


class ActData(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    type_acte: str = Field(..., pattern='^(Naissance|Mariage|Décès)$')
    nom_concerne: str = Field(..., min_length=1, max_length=300)
    date_evenement: datetime
    lieu_evenement: str | None = Field(None, max_length=300)
    details_json: str | None = None
    citoyen_id: str | None = None
    fokontany_id: StrictInt | None = Field(None, gt=0)

    @field_validator('date_evenement', mode='before')
    @classmethod
    def iso_date(cls, value):
        if not isinstance(value, (str, datetime)):
            raise ValueError('Date ISO 8601 requise')
        return utc(value)


class Rejected(Exception):
    def __init__(self, code): self.code = code


def utc(value):
    if isinstance(value, str): value = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if value.tzinfo is not None: value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def iso(value):
    return utc(value).replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')


def canonical(data):
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def territory(db, agent):
    if agent.role not in READERS: raise Rejected('forbidden')
    if agent.role != 'Agent Fokontany': return None
    matches = db.query(Fokontany.id).filter(Fokontany.nom == agent.fokontany).all()
    if len(matches) != 1: raise Rejected('territory_not_assigned')
    return matches[0][0]


def check_scope(entity, scope):
    if scope is not None and entity.fokontany_id != scope: raise Rejected('forbidden')


def validated_data(db, schema, incoming, existing, scope):
    if set(incoming) - set(schema.model_fields): raise Rejected('protected_or_unknown_field')
    merged = {name: getattr(existing, name) for name in schema.model_fields} if existing else {}
    merged.update(incoming)
    if not existing and scope is not None: merged.setdefault('fokontany_id', scope)
    data = schema.model_validate(merged).model_dump()
    for name in ('nom', 'prenom', 'nom_concerne', 'telephone'):
        if name in data:
            data[name] = data[name].strip()
            if not data[name]: raise Rejected('invalid_data')
    fok = data.get('fokontany_id')
    if fok is not None and db.get(Fokontany, fok) is None: raise Rejected('invalid_reference')
    if scope is not None and fok != scope: raise Rejected('forbidden')
    if schema is ActData:
        data['date_evenement'] = utc(data['date_evenement'])
        if data['citoyen_id']:
            data['citoyen_id'] = str(UUID(data['citoyen_id']))
            citizen = db.get(Citoyen, data['citoyen_id'])
            if not citizen or not citizen.is_active: raise Rejected('invalid_reference')
            check_scope(citizen, scope)
            if fok != citizen.fokontany_id: raise Rejected('inconsistent_territory')
    return data


def _apply_record(db, agent, record, ip):
    if record.entity_type not in {'citoyen', 'acte'}: raise Rejected('unsupported_entity')
    entity_id = str(UUID(record.entity_id))
    timestamp = utc(record.timestamp)
    if timestamp > datetime.utcnow() + timedelta(minutes=5): raise Rejected('future_timestamp')
    encoded = canonical(record.data)
    if len(encoded.encode()) > 65536: raise Rejected('record_too_large')
    if record.hash_format == 'json-v1':
        expected = hashlib.sha256(encoded.encode()).hexdigest()
    elif record.hash_format == 'legacy-v1':
        expected = hash_record({k: str(v) for k, v in record.data.items()})
    else: raise Rejected('unsupported_hash_format')
    if expected != record.hash: raise Rejected('invalid_hash')
    scope = territory(db, agent)
    model, schema = (Citoyen, CitizenData) if record.entity_type == 'citoyen' else (ActeEtatCivil, ActData)
    existing = db.query(model).filter(model.id == entity_id).with_for_update().first()
    if existing: check_scope(existing, scope)
    operation = canonical([agent.id, record.client_id, record.entity_type, entity_id, iso(timestamp), encoded])
    key = hashlib.sha256(operation.encode()).hexdigest()
    if db.get(SyncReceipt, key):
        db.rollback()
        return 'accepted', 'already_applied'
    if existing and ((model is Citoyen and not existing.is_active) or
                     (model is ActeEtatCivil and (existing.is_validated or existing.statut not in {'En attente', 'En cours'}))):
        raise Rejected('record_locked')
    data = validated_data(db, schema, record.data, existing, scope)
    if existing and utc(existing.last_update or existing.created_at or datetime.min) > timestamp:
        db.rollback()
        return 'conflicts', 'server_newer'
    if existing and utc(existing.last_update or existing.created_at or datetime.min) == timestamp:
        if not all(getattr(existing, name) == value for name, value in data.items()):
            db.rollback()
            return 'conflicts', 'timestamp_collision'
    else:
        if existing:
            for name, value in data.items(): setattr(existing, name, value)
        else:
            existing = model(id=entity_id, **data)
            if model is ActeEtatCivil:
                existing.reference, existing.agent_id, existing.statut = gen_reference('EC'), agent.id, 'En attente'
            db.add(existing)
        existing.last_update = timestamp
        existing.sync_updated_at = datetime.utcnow()
        if model is ActeEtatCivil:
            existing.hash_sha256 = acte_integrity_hash(existing)
        log_action(db, action='SYNC', entite=record.entity_type, entite_id=entity_id,
                   detail='Modification hors connexion acceptée', agent_id=agent.id, ip_address=ip, commit=False)
    db.add(SyncReceipt(operation_key=key, agent_id=agent.id, entity_type=record.entity_type, entity_id=entity_id))
    db.commit()
    return 'accepted', 'applied'


def apply_record(db, agent, record, ip):
    for attempt in range(2):
        try:
            return _apply_record(db, agent, record, ip)
        except (IntegrityError, StaleDataError) as exc:
            db.rollback()
            if attempt:
                raise Rejected('concurrent_conflict' if isinstance(exc, StaleDataError) else 'integrity_error')


def push_records(db, agent, records, ip):
    response = {'accepted': [], 'conflicts': [], 'errors': [], 'results': []}
    for index, record in enumerate(records):
        try:
            status, code = apply_record(db, agent, record, ip)
        except Rejected as exc:
            db.rollback()
            status, code = 'errors', exc.code
        except (ValueError, TypeError, ValidationError):
            db.rollback()
            status, code = 'errors', 'invalid_data'
        except IntegrityError:
            db.rollback()
            status, code = 'errors', 'integrity_error'
        except SQLAlchemyError:
            db.rollback()
            logger.error('Échec SQL de synchronisation ; opération non acquittée')
            status, code = 'errors', 'server_error'
        response[status].append(record.entity_id)
        response['results'].append({'index': index, 'entity_type': record.entity_type,
                                    'entity_id': record.entity_id, 'status': status, 'code': code})
    return response


def pull_records(db, agent, entity_type, version, after_id, expected_scope, limit):
    if entity_type not in {'citoyen', 'acte'}: raise HTTPException(422, 'Type non synchronisable')
    try:
        territory_id = territory(db, agent)
        if after_id: after_id = str(UUID(after_id))
        if after_id and version is None: raise ValueError()
    except Rejected: raise HTTPException(403, 'Périmètre non autorisé')
    except ValueError: raise HTTPException(422, 'Curseur invalide')
    clock = db.execute(select(SyncClock.value, SyncClock.instance_id).where(SyncClock.id == 1)).one()
    upper = clock.value
    scope = hashlib.sha256(canonical([clock.instance_id, agent.id, agent.role, territory_id]).encode()).hexdigest()
    if version is not None and expected_scope != scope:
        raise HTTPException(409, 'Périmètre changé ou absent : vider le cache et recommencer sans curseur')
    if version is not None and version > upper:
        raise HTTPException(409, 'Curseur non valable après restauration : recommencer sans curseur')
    query = db.query(SyncChange).filter(SyncChange.entity_type == entity_type, SyncChange.version <= upper)
    if territory_id is not None:
        query = query.filter(or_(SyncChange.old_fokontany_id == territory_id, SyncChange.new_fokontany_id == territory_id))
    if version is not None:
        query = query.filter(or_(SyncChange.version > version,
                                 and_(SyncChange.version == version, SyncChange.entity_id > after_id))) if after_id else query.filter(SyncChange.version > version)
    rows = query.order_by(SyncChange.version, SyncChange.entity_id).limit(limit + 1).all()
    model, schema = (Citoyen, CitizenData) if entity_type == 'citoyen' else (ActeEtatCivil, ActData)
    items = []
    for change in rows[:limit]:
        row = db.get(model, change.entity_id)
        if row is None or (territory_id is not None and row.fokontany_id != territory_id):
            items.append({'entity_id': change.entity_id, 'version': change.version, 'data': None, 'metadata': {'removed': True}})
            continue
        # A newer commit may replace an older snapshot; its later feed entry remains available.
        data = {name: getattr(row, name) for name in schema.model_fields}
        if model is ActeEtatCivil: data['date_evenement'] = iso(data['date_evenement'])
        metadata = {'is_active': row.is_active} if model is Citoyen else {
            'reference': row.reference, 'statut': row.statut, 'is_validated': row.is_validated, 'hash_sha256': row.hash_sha256}
        items.append({'entity_id': row.id, 'version': row.sync_version,
                      'timestamp': iso(row.last_update or row.sync_updated_at),
                      'server_timestamp': iso(row.sync_updated_at), 'data': data, 'metadata': metadata})
    more = len(rows) > limit
    return {'items': items, 'has_more': more, 'scope': scope,
            'cursor': {'version': rows[limit - 1].version, 'after_id': rows[limit - 1].entity_id, 'scope': scope}
                      if more else {'version': upper, 'after_id': None, 'scope': scope}}
