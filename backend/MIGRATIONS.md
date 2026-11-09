# Migrations de base de données

Exécuter les commandes depuis `backend`, avec l'environnement Python activé. `DATABASE_URL` et les paramètres applicatifs proviennent de l'environnement ou `.env` ; aucune URL ni clé n'est stockée dans `alembic.ini`. Configurer les paramètres de production décrits dans `DEPLOIEMENT.md` avant ces commandes. Les migrations ne créent aucun compte.

## Nouvelle installation

```bash
pip install -r requirements.txt
alembic upgrade head
python -m app.schema check
alembic check
python manage_admin.py --matricule ADMIN-0001 --email admin@example.mg --nom Admin --prenom Commune
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

L'API et les commandes d'initialisation refusent une base sans version ou en retard. Elles n'appliquent pas de migration automatiquement, même en développement.

## Base existante créée avant Alembic

1. Arrêter les processus qui peuvent écrire dans la base.
2. Effectuer une sauvegarde vérifiable : API de sauvegarde SQLite ou `pg_dump` pour PostgreSQL. Conserver aussi les fichiers/documents hors de la base. Ne pas copier simplement un fichier SQLite en cours d'écriture.
3. Avec le même `DATABASE_URL` que l'application :

```bash
python -m app.schema adopt
alembic current
alembic check
python -m app.schema check
```

4. Redémarrer l'API et vérifier `/api/health`, une connexion et la lecture d'un dossier existant.

L'adoption reconnaît trois états : tables historiques (`0001`), ajout de `fichiers_citoyens` (`0002`), puis ajout de `paiements_demandes` (`0003`). Elle contrôle colonnes, types, nullabilité, index, contraintes uniques, clés étrangères, clés primaires et valeurs des enums natifs PostgreSQL avant d'attribuer une version. Elle applique ensuite uniquement les migrations manquantes.

Une table inconnue, un schéma incomplet ou une divergence détectée provoquent un refus sans attribution de version. Examiner l'écart et préparer une migration de reprise adaptée ; ne pas contourner ce contrôle avec `alembic stamp head`. Une base déjà versionnée utilise `alembic upgrade head`, pas `adopt`. L'adoption concerne les instantanés historiques reconnus, pas les futures mises à jour des modèles.

## Mises à jour et nouvelles migrations

Après sauvegarde et arrêt des écritures, exécuter `alembic upgrade head`, `python -m app.schema check` et `alembic check`. Exécuter les migrations une seule fois avant de démarrer les workers. La coordination des déploiements n'est pas fournie par Alembic.

`schema check` contrôle la version ; `alembic check` recherche les écarts détectables entre schéma et modèles. Alembic ne détecte pas tous les changements, notamment les renommages et certaines contraintes.

Pour faire évoluer le schéma, sur une base de développement à jour :

```bash
# Modifier les modèles, puis :
alembic revision --autogenerate -m "Description du changement"
# Relire et compléter upgrade/downgrade avant application.
alembic upgrade head
alembic check
python -m pytest tests -q
```

Ne pas modifier les révisions déjà publiées. Relire particulièrement les migrations de données, les enums PostgreSQL et les changements SQLite qui reconstruisent des tables.

## Retours arrière

`alembic downgrade -1` exécute le retour arrière de la dernière révision. Les trois migrations initiales créent des tables : leurs downgrades suppriment ces tables et leurs données. Un rollback applicatif ne doit pas déclencher cette commande automatiquement ; restaurer la sauvegarde lorsque la conservation des données est nécessaire.

## Tests

Les bases jetables vérifient migration, reprise, conservation des données, réexécution, absence de dérive, refus de schémas incompatibles et downgrade/re-upgrade. Pour inclure PostgreSQL, fournir une URL exclusivement de test :

```bash
MIGRATION_TEST_POSTGRES_URL=postgresql://utilisateur@hote/base_test python -m pytest tests -q
```

La fixture PostgreSQL crée et supprime des schémas temporaires isolés ; l'utilisateur doit disposer de cette permission. Sans cette variable, seuls SQLite et les tests applicatifs sont sélectionnés. Les tests de charge et de concurrence métier ne sont pas inclus.
