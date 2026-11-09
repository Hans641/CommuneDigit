# Récupération du mot de passe citoyen

## Fonctionnement

Le portail citoyen propose « Mot de passe oublié ? ». Les pages `/forgot-password` et `/reset-password` sont accessibles sans session. L'utilisateur demande un lien, puis définit un mot de passe d'au moins huit caractères. Le lien expire après une heure et fonctionne une seule fois. Une nouvelle demande acceptée invalide les liens précédents ; un changement de mot de passe invalide également tous les liens en attente et les sessions citoyennes précédentes.

Cette mise à jour impose une reconnexion aux citoyens qui possédaient déjà un jeton de session. Les comptes agents ne sont pas concernés par ce parcours. Leurs sessions et leur récupération restent distinctes.

## Installation et migration

Depuis `backend`, exécuter `alembic upgrade head` avant de redémarrer l'API. La migration `0004` ajoute `password_resets` et `password_reset_limits`, sans modifier les comptes existants. Voir `MIGRATIONS.md` pour la reprise d'une base non versionnée. Ne pas revenir à `0003` tant que le code de récupération est actif : cela supprime les liens et les compteurs, et l'API refusera cette ancienne version.

## Développement : courrier local

```dotenv
EMAIL_BACKEND=file
EMAIL_OUTBOX_DIR=/tmp/communedigit-mail
PUBLIC_FRONTEND_URL=http://localhost:8082
```

Aucun message ne part vers un fournisseur. Les emails `.eml` sont enregistrés dans un dossier privé (0700), avec des fichiers privés (0600). Ouvrir le courrier local et suivre son lien pour tester la réinitialisation. Ce dossier contient des liens sensibles : ne pas le publier, le servir par HTTP ni le committer. Supprimer les courriers de test lorsqu'ils ne sont plus nécessaires.

`PUBLIC_FRONTEND_URL` doit correspondre à l'URL réellement accessible dans le navigateur de l'utilisateur. Le jeton se trouve dans le fragment `#token=…`, qui n'est pas envoyé au serveur web ; la page le retire de l'URL après chargement. Un rafraîchissement après ce retrait nécessite de rouvrir le lien du courrier.

## SMTP réel (configuration ultérieure)

```dotenv
EMAIL_BACKEND=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
EMAIL_FROM=noreply@example.com
PUBLIC_FRONTEND_URL=https://commune.example.com
# SMTP_USERNAME et SMTP_PASSWORD : renseigner via la configuration privée.
```

Le transport vérifie TLS : STARTTLS sur le port 587 (et les autres ports configurés hors 465), TLS implicite sur 465. Le mot de passe SMTP ne doit apparaître ni dans Git, ni dans les arguments de lancement. L'accès réseau au fournisseur et ses identifiants doivent être configurés avant un test réel. Le transport a été testé avec un serveur simulé ; cela ne constitue pas une validation de livraison auprès d'un fournisseur externe.

En production, le transport fichier est interdit. Utiliser SMTP avec une URL frontend HTTPS, ou `EMAIL_BACKEND=disabled` pour désactiver explicitement la récupération. Avec `disabled`, le formulaire reçoit une indisponibilité (503), indépendamment de l'existence du compte.

## Protections et limites

- Stockage de l'empreinte SHA-256 du jeton aléatoire de 256 bits ; aucun jeton brut dans la table de récupération ni dans les réponses API.
- Consommation conditionnelle atomique, compte actif obligatoire et invalidation des sessions liée au mot de passe courant.
- Réponse générique (202) pour adresse inconnue, inactive, limitée ou échec d'envoi ; le contenu et le code ne révèlent pas l'existence du compte. Ce mécanisme ne garantit pas un temps de réponse identique.
- Limites persistées : une demande par email par minute, dix demandes par adresse IP par quinze minutes. Les en-têtes X-Forwarded-For arbitraires ne sont pas utilisés par le service ; configurer correctement le proxy de confiance devant Uvicorn.
- Les compteurs expirés et anciens jetons expirés sont purgés au fil des demandes. Les courriers locaux doivent être nettoyés séparément.
- En cas d'échec de transport, le nouveau jeton est supprimé et une erreur générique est journalisée, sans lien, destinataire ni identifiant SMTP. Il faut attendre la fin de la limitation avant de réessayer.
- L'envoi SMTP est synchrone avec délai de connexion de dix secondes ; une file d'envoi durable et les reprises automatiques restent une évolution distincte. SMS et notifications push ne sont pas intégrés.
