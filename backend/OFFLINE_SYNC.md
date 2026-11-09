# Synchronisation backend des citoyens et actes

L'API propose désormais le dépôt d'opérations (`POST /api/sync/`) et la lecture des changements (`GET /api/sync/citoyen`, `GET /api/sync/acte`). Elle nécessite un jeton agent. La file persistante, le stockage local et le déclenchement automatique dans l'application mobile restent à intégrer : la présence de cette API ne rend pas encore l'application utilisable hors connexion.

## Déposer une opération

Un lot contient au maximum 200 enregistrements. Exemple de construction Python :

```python
import hashlib, json, uuid
from datetime import datetime, timezone

data = {"nom": "RAKOTO", "prenom": "Jean", "telephone": "0340000000"}
record = {
    "entity_type": "citoyen",
    "entity_id": str(uuid.uuid4()),
    "client_id": "android-appareil-01",
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "data": data,
    "hash_format": "json-v1",
    "hash": hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=False, allow_nan=False).encode("utf-8")).hexdigest(),
}
# POST /api/sync/ avec {"records": [record]} et Authorization: Bearer ...
```

Utiliser un UUID canonique pour l'entité et un identifiant d'appareil stable (lettres, chiffres, tirets et underscores, 100 caractères maximum). Créer l'UUID une seule fois, puis conserver exactement le même enregistrement pour les nouvelles tentatives après une perte de connexion. La taille canonique de `data` est limitée à 64 Kio par enregistrement ; adapter la taille des lots aux limites du proxy HTTP.

`json-v1` calcule SHA-256 sur le JSON UTF-8 aux clés triées, sans espaces et sans échappement des caractères Unicode. Les identifiants fokontany sont des entiers. Le mode historique `legacy-v1` (valeur par défaut pour les anciens clients) reste accepté ; il reproduit le tri et la conversion `str` Python de l'ancien endpoint et n'est pas recommandé pour de nouveaux clients JavaScript. Ce checksum n'est ni une signature ni une autorisation.

### Champs acceptés

- `citoyen` : `nom`, `prenom`, `telephone`, `cin`, `adresse`, `fokontany_id`. Une création nécessite les trois premiers champs.
- `acte` : `type_acte` (Naissance, Mariage ou Décès), `nom_concerne`, `date_evenement`, `lieu_evenement`, `details_json` (chaîne), `citoyen_id`, `fokontany_id`. Une création nécessite les trois premiers champs.

Une mise à jour peut contenir seulement les champs modifiés. La référence de l'acte, son auteur, son statut initial et son empreinte sont produits par le serveur. Les relations sont vérifiées avant écriture. Envoyer les citoyens avant les actes qui les référencent dans un même lot.

Les champs de validation, d'activation, d'auteur, de version et les relations ORM sont interdits. Les actes validés/rejetés et les citoyens désactivés ne sont pas modifiables par ce canal. Les paiements, comptes et droits ne sont pas synchronisables par cet endpoint.

### Droits, dates et conflits

L'administrateur et le superviseur peuvent écrire globalement. L'agent fokontany ne peut créer/modifier que dans son fokontany ; sa création sans `fokontany_id` y est rattachée automatiquement. Une affectation absente ou ambiguë est refusée. Le ministère peut lire mais ne peut pas déposer d'opération.

Le timestamp métier doit être ISO 8601. Un fuseau explicite est recommandé ; les anciens timestamps sans fuseau sont interprétés en UTC. Les dates sont normalisées en UTC. Une horloge client dépassant le serveur de plus de cinq minutes est refusée.

Une modification plus ancienne que `last_update` produit un conflit. À timestamp égal, des valeurs différentes produisent aussi un conflit ; aucun gagnant arbitraire n'est choisi. Un reçu durable reconnaît une opération déjà appliquée, même si le dossier a changé depuis. `accepted` signifie donc « appliquée au moins une fois », pas « identique à la version actuelle ».

Chaque opération réussie enregistre données, audit, reçu et changement dans une même transaction. L'acquittement vient après commit. L'échec d'une ligne n'annule pas les autres opérations réussies du lot. Les erreurs d'enveloppe (lot trop grand, champs structurels manquants, etc.) restent des erreurs HTTP 422 du lot entier.

### Réponse

`accepted`, `conflicts` et `errors` conservent le format historique (listes d'IDs). `results` fournit pour chaque position du lot son `index`, `entity_type`, `entity_id`, `status` et `code`.

Principaux codes : `applied`, `already_applied`, `server_newer`, `timestamp_collision`, `invalid_data`, `invalid_hash`, `protected_or_unknown_field`, `invalid_reference`, `inconsistent_territory`, `forbidden`, `territory_not_assigned`, `record_locked`, `unsupported_entity`, `unsupported_hash_format`, `future_timestamp`, `record_too_large`, `integrity_error`, `concurrent_conflict`, `server_error`.

Le client ne supprime de sa file que les opérations acquittées. Un conflit nécessite une lecture du serveur et une résolution explicite ; ne pas régénérer automatiquement le timestamp pour forcer l'écrasement. Une erreur technique peut être retentée en conservant l'opération d'origine.

## Lire les changements

Premier appel : `GET /api/sync/citoyen?limit=100`. La réponse fournit `items`, `has_more`, `scope` et `cursor`.

```json
{
  "items": [],
  "has_more": false,
  "scope": "marqueur-du-perimetre",
  "cursor": {"version": 123, "after_id": null, "scope": "marqueur-du-perimetre"}
}
```

Transmettre les champs du curseur au prochain appel, en omettant les valeurs nulles. Continuer tant que `has_more=true`, puis sauvegarder également le curseur final pour la prochaine synchronisation. Garder un curseur distinct par type d'entité et par session/périmètre. Le marqueur inclut aussi une identité propre à la base. Vérifier le périmètre avant de rejouer une file locale. Une reprise avec un périmètre changé ou absent est refusée avec HTTP 409 : vider le cache concerné et recommencer sans curseur.

Un item contient l'UUID, une `version` serveur, les champs métier `data`, les métadonnées en lecture seule et les dates UTC. Les changements peuvent retourner plusieurs fois la version actuelle d'une entité : appliquer des upserts locaux idempotents et ignorer une version plus ancienne que celle du cache. Ne pas retransmettre les métadonnées dans `data` lors d'une écriture.

`metadata.is_active=false` signale un citoyen désactivé. `metadata.removed=true` avec `data=null` demande le retrait du cache, notamment après transfert vers un autre fokontany ou suppression physique. La notification de retrait ne contient aucune donnée personnelle du nouveau périmètre. Purger aussi les caches à la déconnexion et ne pas mélanger les sessions de plusieurs agents.

## Garanties et exploitation

La migration `0005` ajoute les reçus, le journal de changements, un compteur transactionnel et les marqueurs serveur. Les anciennes entités sont inscrites dans le journal à la version zéro. Appliquer `alembic upgrade head`, puis redémarrer tous les processus d'écriture.

Le curseur n'utilise pas l'horloge du téléphone ni une simple date serveur : un compteur verrouillé jusqu'au commit empêche une transaction tardive de publier une version antérieure au curseur déjà remis au client. Le suivi ORM couvre également les créations/modifications en ligne. Un contrôle optimiste empêche les mises à jour concurrentes de s'écraser, y compris sur SQLite. Les conflits concurrents hors endpoint sync reçoivent HTTP 409.

Ces garanties supposent des écritures via les objets ORM applicatifs. Les requêtes SQL externes et les mises à jour ORM en masse ne produisent pas ce journal : ne pas les utiliser pour ces entités sans prise en charge explicite du suivi. Les anciens CRUD restent à aligner complètement sur les permissions territoriales ; cette étape impose le périmètre aux routes de synchronisation.

Le compteur global sérialise brièvement les écritures citoyen/acte. C'est un compromis adapté au volume actuel, à mesurer avant une montée en charge. Les reçus et le journal ne sont pas purgés automatiquement : une rétention future devra définir quand imposer une resynchronisation complète. Les paiements restent hors de ce protocole.

Le retour de `0005` vers `0004` conserve les tables métier, mais supprime journal, reçus et marqueurs de synchronisation. Il exige SQLite >=3.35 pour le DROP COLUMN natif, ou PostgreSQL. Après réapplication, vider les caches et repartir sans anciens curseurs ; ne pas réutiliser un curseur d'une autre base ou d'une restauration.
