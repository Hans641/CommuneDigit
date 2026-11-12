# Tests de concurrence PostgreSQL

La suite utilise `MIGRATION_TEST_POSTGRES_URL`, exclusivement vers une base de
**test jetable**. La fixture crée et supprime un schéma unique par scénario ; le
compte SQL doit disposer de ces droits. Ne pas utiliser une base de production.
Aucune URL ni aucun identifiant réel ne doit être committé.

## Lancer avec une base de test existante

Depuis `backend`, après installation de `requirements.txt`, fournir l'URL par
la configuration privée de l'environnement puis lancer :

```bash
APP_ENV=test EMAIL_BACKEND=disabled SEED_DEMO_ACCOUNTS=true \
  .venv/bin/python -m pytest tests -q
```

Sans cette URL, les migrations et les scénarios communs tournent sur SQLite ;
les cinq scénarios de concurrence de paiement sont explicitement ignorés.
Pour ne lancer que les paiements sur PostgreSQL :

```bash
APP_ENV=test EMAIL_BACKEND=disabled SEED_DEMO_ACCOUNTS=true \
  .venv/bin/python -m pytest tests/test_payment_concurrency.py -k postgresql -q
```

## Base locale jetable avec Docker

En Cloud, utiliser le daemon local et conserver la configuration proxy existante :

```bash
docker_local() {
  env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS \
    -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
    docker --host=unix:///var/run/docker.sock "$@"
}
docker_local info --format '{{.ServerVersion}}'
docker_local run -d --name communedigit-postgres-concurrency \
  --publish 127.0.0.1:55432:5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=communedigit_test \
  postgres:16-bookworm
docker_local exec communedigit-postgres-concurrency pg_isready -U postgres -d communedigit_test
```

Attendre que `pg_isready` réussisse avant les tests. Si le nom ou le port est déjà
utilisé, inspecter le processus existant ; ne pas supprimer un conteneur inconnu.
Le mode `trust` est réservé à ce serveur de test accessible en boucle locale,
sans données réelles. Pour une base partagée, utiliser une authentification privée.

Depuis `backend` :

```bash
MIGRATION_TEST_POSTGRES_URL=postgresql://postgres@127.0.0.1:55432/communedigit_test \
  APP_ENV=test EMAIL_BACKEND=disabled SEED_DEMO_ACCOUNTS=true \
  .venv/bin/python -m pytest tests -q
```

Après les tests, retirer uniquement le conteneur créé pour cette vérification :

```bash
docker_local rm -f communedigit-postgres-concurrency
```

## Garanties vérifiées et limites

`test_payment_concurrency.py` appelle les fonctions métier des routes avec des
sessions SQL indépendantes et des identités de test explicites. Des barrières
synchronisent les lectures d'idempotence ou les tentatives de verrouillage des
demandes. Des délais bornent les attentes ; une exception SQL inattendue fait
échouer le test. Cette suite complète les tests HTTP existants, sans remplacer
les tests d'authentification.

- Deux encaissements identiques avec la même clé : même transaction, un seul audit.
- Même clé avec deux montants : un encaissement et un refus 409.
- Deux rapprochements identiques : une seule association, un événement et une notification.
- Une transaction pour deux demandes : une seule demande réglée, un refus 409.
- Deux transactions pour une demande : un seul rapprochement, un refus 409.

Les scénarios relisent les données après commit et vérifient montants, propriétaire,
références et absence de doublons. La suite complète inclut également les tests
existants de migration, consommation concurrente de jeton et synchronisation sur
PostgreSQL. Les tests HTTP du parcours citoyen, des permissions et de l'audit
conservent leur base SQLite temporaire, même si cette URL est fournie.

Ce sont des tests à deux écritures concurrentes, pas des tests de charge, de
panne réseau, de webhook opérateur ou une validation de paiement réel.
