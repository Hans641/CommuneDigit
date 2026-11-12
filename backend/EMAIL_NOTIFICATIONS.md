# Notifications email durables — Mailjet SMTP

Les notifications internes restent disponibles sans fournisseur. Les emails
métier sont optionnels (`NOTIFICATION_EMAIL_ENABLED=false` par défaut).
Le déploiement du code n'active aucun envoi. SMS et push ne sont pas intégrés.

## Migration et démarrage

Depuis `backend`, avec les variables privées de la base cible :

```bash
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m app.schema check
.venv/bin/python -m alembic check
```

La migration `0006` ajoute `notification_emails`. Les anciennes notifications
sont conservées sans être renvoyées. Arrêter les anciens workers avant une mise
à jour ; ne pas lancer le nouveau worker sur un schéma ancien. Un retour à
`0005` supprime la file, sans annuler les emails déjà acceptés par le transport.

Après configuration, lancer l'API puis un processus worker distinct sous le
superviseur du déploiement, avec la **même base et configuration** :

```bash
.venv/bin/python -m app.email_worker
# Un seul lot, utile pour vérification ou lancement planifié :
.venv/bin/python -m app.email_worker --once --limit 25
```

Le worker vérifie le schéma, traite jusqu'à 25 messages par cycle, attend cinq
secondes puis recommence. Le superviseur doit le relancer s'il s'arrête.
Aucun Redis ou broker Celery n'est nécessaire pour cette file SQL.

## Configuration Mailjet

Définir hors Git, dans la configuration privée du déploiement :

```dotenv
NOTIFICATION_EMAIL_ENABLED=true
EMAIL_BACKEND=smtp
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=587
EMAIL_FROM=adresse-validee-chez-mailjet@example.com
PUBLIC_FRONTEND_URL=https://votre-portail.example
```

`SMTP_USERNAME` reçoit la clé API Mailjet et `SMTP_PASSWORD` sa clé secrète.
Ne pas transmettre ces valeurs dans le chat, dans les arguments de commande,
dans des instructions enregistrées ou dans Git. Le transport SMTP nécessite les
valeurs réelles injectées dans le processus ; un placeholder de secret remplacé
par un proxy HTTP ne fournit pas une authentification SMTP.

L'adresse ou le domaine d'expédition doit être validé dans Mailjet. Configurer
SPF/DKIM selon les instructions du compte et vérifier les restrictions éventuelles
du mode d'essai. L'adresse d'expédition n'est pas le nom d'utilisateur SMTP.
L'envoi utilise STARTTLS avec vérification des certificats (ou TLS implicite sur
465). Autoriser la sortie SMTP vers `in-v3.mailjet.com:587` dans le déploiement ;
une autorisation HTTP ne suffit pas. L'accès SMTP et la livraison réelle doivent
être testés avec les clés du compte et un destinataire explicitement autorisé.
Le même transport sert aussi à la récupération de mot de passe existante.

## Développement sans envoi externe

```dotenv
NOTIFICATION_EMAIL_ENABLED=true
EMAIL_BACKEND=file
EMAIL_OUTBOX_DIR=/chemin/prive/communedigit-mail
PUBLIC_FRONTEND_URL=http://localhost:8082
```

Les fichiers `.eml` sont privés. Le statut `sent` signifie alors seulement que le
courrier a été écrit localement, pas qu'un email a été envoyé. Ce mode est interdit
en production. Avec `EMAIL_BACKEND=disabled` ou le drapeau métier désactivé, aucun
nouvel email métier n'est mis en file et le worker suspend les envois existants.
La réactivation ne rejoue pas les notifications créées pendant la désactivation.

## Garanties et exploitation

- Soumission d'une demande, paiement et changement de statut enregistrent leur
  notification et l'envoi en attente dans la transaction métier. Aucun appel SMTP
  n'a lieu pendant la requête HTTP. Une panne SMTP ne bloque pas le dossier.
- Une seule ligne d'envoi par notification ; les transitions répétées sans changement
  ne génèrent pas de nouvelles notifications.
- Un bail SQL atomique de 120 secondes évite deux traitements simultanés normaux,
  y compris sur SQLite. Un worker redémarré reprend les baux expirés.
- Les erreurs temporaires sont réessayées après 60, 120, 240 puis 480 secondes,
  dans une limite de cinq prises en charge. Les refus SMTP définitifs sont marqués
  `failed`. Après un crash sur la dernière tentative, la reprise clôt le travail
  en échec sans nouvel envoi.
- Le destinataire est revérifié avant l'envoi : compte désactivé ou email modifié
  annule le travail (`cancelled`). Supprimer une notification supprime sa file ;
  cela ne peut pas rappeler un email déjà transmis ou en cours de transmission.
- Les emails ne contiennent ni pièces, ni jetons, ni note de rejet ; ils invitent
  à ouvrir le portail authentifié. Les erreurs conservées et compteurs du worker
  ne contiennent pas les réponses SMTP ni les adresses des destinataires.

`sent` indique une acceptation SMTP, **pas une arrivée en boîte de réception**.
Le `Message-ID` reste stable lors des reprises, mais SMTP ne garantit pas une
livraison exactement une fois : un crash après acceptation et avant validation
SQL peut entraîner un doublon. Les bounces/webhooks Mailjet et leur rapprochement
ne sont pas implémentés.

Surveiller les compteurs du worker et, via un accès administratif privé à la base,
les lignes `failed` ainsi que les retards de `pending`/`processing`. Corriger la
cause avant toute remise en attente manuelle ; ne jamais réinitialiser un travail
`sent` sans accepter le risque d'un nouvel envoi. La file contient des adresses
personnelles : limiter les accès et définir une rétention avec les responsables.

## Vérifications

Depuis `backend` :

```bash
APP_ENV=test EMAIL_BACKEND=disabled SEED_DEMO_ACCOUNTS=true \
  .venv/bin/python -m pytest tests -q
```

`test_email_delivery.py` couvre la transaction, les reprises, l'épuisement des
tentatives, les refus permanents, les workers concurrents, les destinataires
obsolètes, la suppression et le parcours HTTP soumission/transition. Le transport
Mailjet SMTP est testé avec un serveur simulé vérifiant TLS. Avec une URL de test
`MIGRATION_TEST_POSTGRES_URL`, les tests de file et de migration sont également
exécutés sur PostgreSQL (voir `CONCURRENCY_TESTS.md`). Ces tests ne constituent
pas une validation d'envoi réel via un compte Mailjet.
