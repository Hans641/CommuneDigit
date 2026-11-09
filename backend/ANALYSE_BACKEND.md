# Parcours citoyen : corrections et limites

Le parcours inscription → dépôt de justificatifs → soumission → notification interne → approbation agent → document HTML → téléchargement est couvert par `tests/test_citizen_workflow.py`.

Corrections : séparation des jetons agents/citoyens, validation des sujets JWT, unicité de l'email indépendante de la casse, stockage des uploads avant soumission avec propriétaire, contrôle des pièces jointes, rattachement à la soumission, suppression des brouillons, génération et renouvellement de documents, échappement HTML, résolution des chemins, notifications de création et historique des transitions.

Les fichiers ne sont plus exposés par des répertoires statiques publics. Le portail utilise le téléchargement authentifié ; les anciennes URLs `/documents/…` et `/uploads/…` restent des identifiants de stockage, pas des liens publics.

## Mise en service

Depuis `backend`, installer `requirements.txt`, puis redémarrer `uvicorn app.main:app`. Le démarrage existant `Base.metadata.create_all` crée la nouvelle table additive `fichiers_citoyens` (aucune colonne existante modifiée). La table historique `pieces_jointes` est conservée : ses anciennes lignes ne sont pas migrées automatiquement et nécessitent un rattachement à leurs propriétaires avant réutilisation. Les nouveaux dépôts utilisent `fichiers_citoyens`.

Tests : `python -m pytest tests -q` depuis `backend`. Les tests utilisent une base SQLite et des répertoires temporaires ; ils n'accèdent pas à la base de développement.

## Fonctionnalités encore incomplètes

- Email, SMS et push : les adaptateurs sont des placeholders. Seules les notifications internes sont validées. Un fournisseur et ses paramètres doivent être intégrés pour une livraison réelle.
- Mot de passe oublié : un token est créé mais aucun email n'est envoyé. Le reset n'a pas encore de mécanisme de consommation unique. Ce parcours ne doit pas être annoncé comme opérationnel.
- Paiement : rapprochement obligatoire avec une transaction du registre, confirmée manuellement par un administrateur ou superviseur. La vérification auprès des opérateurs et les webhooks restent à intégrer.
- Documents : génération HTML, sans PDF ni signature numérique officielle.
- Traitement agent : transitions strictes, contrôle de paiement avant délivrance, statut/historique/notification enregistrés dans une transaction SQL. Une écriture de fichier ne fait pas partie de cette transaction : un échec ultérieur peut laisser un fichier orphelin privé à nettoyer.

La validation porte sur le parcours corrigé, pas sur une certification exhaustive de tous les routers, la concurrence PostgreSQL ou les intégrations externes.


## Traitement sécurisé et rapprochement des encaissements

- Lecture des demandes et justificatifs : administrateur, superviseur et ministère au niveau global ; agent fokontany uniquement pour les demandes dont le citoyen est rattaché au même fokontany. Un citoyen sans rattachement doit être traité par un responsable global. Cette restriction territoriale concerne les demandes citoyennes ; les anciens CRUD citoyens/actes/certificats restent à aligner sur ce périmètre.
- Ministère : lecture, sans mutations. Administration des comptes réservée à l'administrateur. Encaissements manuels réservés aux administrateurs/superviseurs. La validation d'actes et délivrance de certificats nécessitent aussi ces rôles.
- Transitions : Soumise → En traitement ou Rejetée ; En traitement → Approuvée ou Rejetée ; Approuvée → Prête. Prête et Rejetée sont terminales. Répéter le même statut est sans effet ; aucune réouverture implicite.
- Le document est produit automatiquement au passage à Prête, avec paiement rapproché obligatoire pour un service payant. Le citoyen peut aussi le générer après approbation, sous la même condition de paiement. Une URL arbitraire de document final n'est plus acceptée.
- Encaissement : un responsable vérifie le paiement réel hors application et enregistre une transaction via POST /api/transactions/ avec citoyen_id, montant, type_paiement, idempotency_key et référence externe de justificatif. La route citoyenne /payer attend la référence **interne TXN** retournée par ce registre. Elle ne confirme jamais une simple référence MVola inventée par le client.
- Une transaction ne règle qu'une demande, et inversement (contraintes uniques de la nouvelle table paiements_demandes). Même référence et même demande : réponse idempotente. Mauvais montant, mauvais citoyen, transaction déjà utilisée ou absence de rapprochement : refus.
- Les anciens statuts Payé sans rapprochement ne permettent plus la délivrance : ils doivent être rapprochés avec une transaction vérifiée. Les services gratuits ne demandent pas de paiement.
- Redémarrer le backend pour créer la table additive paiements_demandes. Pas de modification des colonnes existantes. Les migrations Alembic et tests de concurrence PostgreSQL restent à mettre en place ; les tests actuels utilisent SQLite. Les verrous de lignes SQL ne sont effectifs que sur une base qui les prend en charge.


## Mode démo et configuration de production

Voir `DEPLOIEMENT.md` et `.env.example`. `PAYMENT_DEMO_ENABLED=true` active les simulations en développement ; le marqueur API `demo` et le type de transaction Démo identifient ces paiements. Les agrégats financiers les excluent. Production : `APP_ENV=production`, clé JWT privée de 32 caractères minimum, `DEBUG=false`, `SEED_DEMO_ACCOUNTS=false`, `PAYMENT_DEMO_ENABLED=false`. Le démarrage refuse les comptes de démonstration actifs utilisant encore leurs mots de passe par défaut. `manage_admin.py` permet de créer un administrateur sans mot de passe partagé ni secret en argument de commande.
