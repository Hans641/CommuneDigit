# Parcours citoyen : corrections et limites

Le parcours inscription → dépôt de justificatifs → soumission → notification interne → approbation agent → document HTML → téléchargement est couvert par `tests/test_citizen_workflow.py`.

Corrections : séparation des jetons agents/citoyens, validation des sujets JWT, unicité de l'email indépendante de la casse, stockage des uploads avant soumission avec propriétaire, contrôle des pièces jointes, rattachement à la soumission, suppression des brouillons, génération et renouvellement de documents, échappement HTML, résolution des chemins, notifications de création et historique des transitions.

Les fichiers ne sont plus exposés par des répertoires statiques publics. Le portail utilise le téléchargement authentifié ; les anciennes URLs `/documents/…` et `/uploads/…` restent des identifiants de stockage, pas des liens publics.

## Mise en service

Depuis `backend`, installer `requirements.txt`, appliquer les migrations Alembic (ou adopter une base existante après sauvegarde), puis démarrer `uvicorn app.main:app`. Voir `MIGRATIONS.md`. Le démarrage contrôle la version du schéma sans créer de tables. La table historique `pieces_jointes` est conservée : ses anciennes lignes ne sont pas migrées automatiquement et nécessitent un rattachement à leurs propriétaires avant réutilisation. Les nouveaux dépôts utilisent `fichiers_citoyens`.

Tests : `python -m pytest tests -q` depuis `backend`. Les tests utilisent une base SQLite et des répertoires temporaires ; ils n'accèdent pas à la base de développement.

## Fonctionnalités encore incomplètes

- Email, SMS et push : les adaptateurs sont des placeholders. Seules les notifications internes sont validées. Un fournisseur et ses paramètres doivent être intégrés pour une livraison réelle.
- Récupération citoyenne : liens à usage unique, expiration, limitation des demandes, révocation des anciennes sessions et formulaires opérationnels. Courrier privé en développement ; transport SMTP préparé mais livraison réelle à configurer et valider. Voir `PASSWORD_RECOVERY.md`.
- Paiement : rapprochement obligatoire avec une transaction du registre, confirmée manuellement par un administrateur ou superviseur. La vérification auprès des opérateurs et les webhooks restent à intégrer.
- Documents : génération HTML, sans PDF ni signature numérique officielle.
- Traitement agent : transitions strictes, contrôle de paiement avant délivrance, statut/historique/notification enregistrés dans une transaction SQL. Une écriture de fichier ne fait pas partie de cette transaction : un échec ultérieur peut laisser un fichier orphelin privé à nettoyer.

La validation porte sur le parcours corrigé, pas sur une certification exhaustive de tous les routers, la concurrence PostgreSQL ou les intégrations externes.


## Traitement sécurisé et rapprochement des encaissements

- Lecture des demandes et justificatifs : administrateur, superviseur et ministère au niveau global ; agent fokontany uniquement pour les demandes dont le citoyen est rattaché au même fokontany. Un citoyen sans rattachement doit être traité par un responsable global. Les CRUD citoyens/actes/certificats appliquent également un périmètre territorial (voir ci-dessous).
- Ministère : lecture, sans mutations. Administration des comptes réservée à l'administrateur. Encaissements manuels réservés aux administrateurs/superviseurs. La validation d'actes et délivrance de certificats nécessitent aussi ces rôles.
- Transitions : Soumise → En traitement ou Rejetée ; En traitement → Approuvée ou Rejetée ; Approuvée → Prête. Prête et Rejetée sont terminales. Répéter le même statut est sans effet ; aucune réouverture implicite.
- Le document est produit automatiquement au passage à Prête, avec paiement rapproché obligatoire pour un service payant. Le citoyen peut aussi le générer après approbation, sous la même condition de paiement. Une URL arbitraire de document final n'est plus acceptée.
- Encaissement : un responsable vérifie le paiement réel hors application et enregistre une transaction via POST /api/transactions/ avec citoyen_id, montant, type_paiement, idempotency_key et référence externe de justificatif. La route citoyenne /payer attend la référence **interne TXN** retournée par ce registre. Elle ne confirme jamais une simple référence MVola inventée par le client.
- Une transaction ne règle qu'une demande, et inversement (contraintes uniques de la nouvelle table paiements_demandes). Même référence et même demande : réponse idempotente. Mauvais montant, mauvais citoyen, transaction déjà utilisée ou absence de rapprochement : refus.
- Les anciens statuts Payé sans rapprochement ne permettent plus la délivrance : ils doivent être rapprochés avec une transaction vérifiée. Les services gratuits ne demandent pas de paiement.
- Appliquer les migrations Alembic avant redémarrage. Les migrations et les scénarios de concurrence des paiements sont validés sur PostgreSQL 16 ; voir `CONCURRENCY_TESTS.md`. Les verrous de lignes SQL ne sont effectifs que sur une base qui les prend en charge.


## Mode démo et configuration de production

Voir `DEPLOIEMENT.md` et `.env.example`. `PAYMENT_DEMO_ENABLED=true` active les simulations en développement ; le marqueur API `demo` et le type de transaction Démo identifient ces paiements. Les agrégats financiers les excluent. Production : `APP_ENV=production`, clé JWT privée de 32 caractères minimum, `DEBUG=false`, `SEED_DEMO_ACCOUNTS=false`, `PAYMENT_DEMO_ENABLED=false`. Le démarrage refuse les comptes de démonstration actifs utilisant encore leurs mots de passe par défaut. `manage_admin.py` permet de créer un administrateur sans mot de passe partagé ni secret en argument de commande.


## Synchronisation hors connexion

Le backend dispose d’un push validé avec reçus durables et d’un pull paginé par journal transactionnel. Les droits fokontany, conflits de dates et écritures concurrentes sont contrôlés. La migration `0005` inscrit également les modifications en ligne et les transferts de périmètre. Voir `OFFLINE_SYNC.md`. Le client mobile dispose maintenant du stockage chiffré et de la file de renvoi (voir `mobile/README.md`). La validation native sur appareil, la rétention du journal, les tests de charge restent à traiter.


## Périmètre des anciens CRUD citoyens, actes et certificats

- Administrateur et superviseur : lecture et écriture globales. Ministère MID : lecture globale uniquement. Validation des actes et délivrance des certificats réservées aux responsables.
- Agent Fokontany : lecture et modification des citoyens et actes portant son `fokontany_id` ; certificats accessibles via le fokontany du citoyen rattaché. Listes, accès individuels et statistiques des actes suivent le même filtre. Un dossier hors périmètre répond 404.
- Une affectation absente ou correspondant à plusieurs fokontany ne donne aucun accès (403). Le rattachement actuel des agents repose encore sur un nom de fokontany ; migrer vers une clé étrangère serait une évolution distincte.
- Lors d'une création par un agent local, le fokontany omis est celui de l'agent. Il ne peut pas écrire ou transférer vers un autre fokontany. Un certificat local exige un citoyen rattaché accessible ; un acte lié à un citoyen doit porter le même fokontany. Les dossiers sans rattachement restent accessibles aux lecteurs globaux.
- Tests de régression : `tests/test_record_permissions.py`. Les autres familles de routes (transactions, alertes, tableau de bord) ne sont pas modifiées par ce chantier. Les intégrations externes restent un chantier distinct. La validation de concurrence PostgreSQL est décrite dans `CONCURRENCY_TESTS.md`.


## Atomicité des écritures auditées

Les créations, modifications et désactivations déjà auditées des citoyens, actes,
certificats et agents, la publication d'alertes et la mise à jour de `last_login`
partagent désormais une seule transaction avec leur entrée `AuditLog`. Un échec
avant validation annule aussi les changements du journal de synchronisation.
Les encaissements et la synchronisation conservent leur transaction existante.

`log_action` exige des arguments nommés après la session. Avec `commit=False`,
il ajoute et flush l'audit sans valider la transaction ; la route committe ensuite.
Les événements autonomes LOGIN_FAIL et LOGOUT conservent leur propre commit.
Les appels historiques inversant identifiant, détail et agent sont corrigés pour
les nouvelles entrées ; les anciennes données ne sont pas réécrites.

`tests/test_atomic_audit.py` couvre 15 opérations : succès, échec à l'insertion
de l'audit et échec avant commit. Les contrôles relisent les données avec une
nouvelle session et vérifient aussi l'absence de changement du journal de sync.
La suite d’atomicité utilise SQLite ; les tests de concurrence PostgreSQL sont décrits séparément dans `CONCURRENCY_TESTS.md`.
Ce chantier ne généralise pas l'audit aux opérations qui n'en avaient pas et
ne rend pas transactionnels les fichiers ou les envois externes.
