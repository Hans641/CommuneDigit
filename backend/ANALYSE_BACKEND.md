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
- Paiement : la route citoyenne accepte une déclaration client et ne vérifie pas de transaction auprès d'un opérateur. Ce n'est pas une preuve de paiement réel.
- Documents : génération HTML, sans PDF ni signature numérique officielle.
- Traitement agent : l'historique est persisté ; une machine à états métier stricte, les règles de paiement avant délivrance et l'atomicité complète entre fichiers, notifications et statut restent à définir et implémenter.

La validation porte sur le parcours corrigé, pas sur une certification exhaustive de tous les routers, la concurrence PostgreSQL ou les intégrations externes.
