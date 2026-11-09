# CommuneDigit mobile — saisie hors connexion

Le mobile utilise les routes de synchronisation décrites dans [OFFLINE_SYNC.md](../backend/OFFLINE_SYNC.md). Les listes Citoyens et Actes proviennent du cache autorisé ; leurs formulaires enregistrent sur l'appareil avant tout envoi. Les paiements restent en ligne, sans file hors connexion.

## Installer et lancer

```bash
cd mobile
npm ci
npm start
# Dans un autre terminal, avec SDK/émulateur ou téléphone connecté :
npm run android
# Sur macOS, après installation des dépendances CocoaPods :
bundle install
bundle exec pod install --project-directory=ios
npm run ios
```

Les hôtes Android/iOS sont issus du template officiel React Native 0.73.4. Android nécessite Java 17, SDK/Build Tools 34 et le NDK indiqué dans `android/build.gradle`. iOS nécessite macOS, Xcode et CocoaPods. La signature et l'identifiant de distribution sont à configurer pour les versions destinées à être publiées. Android release n'utilise pas automatiquement la clé publique de debug.

Sur l'écran de connexion, saisir l'URL de l'API, terminée par `/api`. Android émulateur peut utiliser `http://10.0.2.2:8000/api`, iOS simulateur `http://localhost:8000/api`. Un téléphone physique doit utiliser une URL réellement accessible depuis son réseau. HTTP n'est accepté qu'en développement ; une version release exige HTTPS. Le backend doit écouter sur une interface accessible et son accès réseau doit être autorisé.

La première connexion et l'établissement du périmètre nécessitent le serveur. Une session déjà ouverte peut être restaurée hors connexion tant que son JWT n'a pas expiré. Aucun mot de passe n'est stocké pour une authentification locale.

## Utilisation

1. Se connecter comme agent et attendre la première synchronisation.
2. Dans Citoyens ou Actes, « Nouveau » ouvre un formulaire. « Enregistrer sur cet appareil » ne réussit qu'après écriture persistante.
3. Une coupure réseau conserve les saisies dans la file. Une nouvelle tentative garde UUID, horodatage, appareil et checksum identiques. Les citoyens sont acquittés avant les actes qui les référencent.
4. Au retour du réseau, au passage au premier plan et périodiquement au premier plan, le mobile vérifie le compte/périmètre, récupère les changements puis transmet les opérations. « Synchroniser maintenant » est également disponible. Une connexion LAN est utilisable même si la sonde Internet du téléphone échoue.
5. Paramètres affiche les conflits. « Comparer et modifier » montre les données serveur ; enregistrer de nouveau est une décision explicite de renvoi. « Conserver la version serveur » abandonne les modifications locales du dossier après confirmation. Aucun timestamp n'est régénéré automatiquement pour écraser un conflit.

La file est traitée par lots limités, avec une seule opération par entité à la fois. Les modifications ajoutées pendant un envoi ne sont pas supprimées par l'acquittement de l'envoi précédent. Une réponse incomplète ou mal formée ne vide pas la file. Les erreurs techniques conservent les opérations pour une reprise ultérieure.

## Sessions et périmètres

Le JWT et les clés de cache sont stockés dans Keychain/Keystore, pas dans AsyncStorage. Chaque couple URL backend / identifiant agent possède son espace. Les callbacks d'une ancienne session ne peuvent pas écrire dans le cache d'un autre compte.

Une expiration ou un refus de session verrouille l'écran et conserve la file chiffrée pour une reconnexion en ligne du même compte. Un changement d'affectation/périmètre ou une restauration incompatible réinitialise les données et la file concernées avant tout envoi, avec un message explicite. Un dossier devenu inaccessible est retiré du cache avec ses modifications locales dépendantes. Le mobile ne peut pas détecter une révocation serveur pendant une coupure ; les sessions hors ligne restent bornées par l'expiration locale du jeton.

La déconnexion explicite demande confirmation : elle efface le cache, les saisies non transmises et la clé de ce compte sur l'appareil. Il faut synchroniser avant de se déconnecter si l'on veut conserver ces saisies sur le serveur. Une session expirée n'est pas une déconnexion volontaire : ses données restent récupérables après réauthentification.

## Stockage

Le cache et la file sont chiffrés ensemble en AES-256-GCM (`@noble/ciphers`) avec clé aléatoire propre au compte, nonce aléatoire par génération et contexte lié au compte. La clé est conservée dans le trousseau du système, avec accès lorsque l'appareil est déverrouillé et sans transfert de clé vers un autre appareil sur iOS.

Le ciphertext est découpé en blocs bornés. Une nouvelle génération complète est écrite avant de remplacer atomiquement son manifeste ; une interruption laisse l'ancienne génération disponible. Les anciennes générations sont nettoyées après commit et les générations orphelines au chargement. Une clé absente ou un contenu altéré provoquent une erreur, sans écrasement silencieux. Un disque plein laisse la version précédemment enregistrée disponible.

Le pilote borne le document local à 8 Mio UTF-8 ; Android réserve 64 Mio à AsyncStorage pour permettre les générations temporaires. Le stockage est adapté à un périmètre pilote, pas présenté comme une base mobile sans limite : mesurer le coût des gros périmètres et envisager une base chiffrée par lignes pour des volumes supérieurs. Les cycles sans changement ne réécrivent pas le cache ; le dernier contrôle est persisté au plus toutes les cinq minutes.

Le chiffrement au repos ne remplace pas le verrouillage du téléphone. Une réinitialisation du stockage ou la perte du trousseau peut rendre les saisies non transmises irrécupérables : ne pas effacer les données de l'application comme simple méthode de dépannage.

## Vérifications automatisées

```bash
npm test -- --runInBand
npm run bundle:android
npm run bundle:ios
```

Les tests couvrent le moteur, les écritures interrompues, le chiffrement, les comptes séparés, la fermeture pendant un envoi, les écrans et la restauration de session. Les bundles sont produits sous `mobile/build` (ignoré par Git).

Un test complémentaire utilise une API **jetable**, avec les comptes de démonstration. Depuis `backend`, dans un terminal dédié :

```bash
MOBILE_E2E_DIR="$(mktemp -d)"
export DATABASE_URL="sqlite:///$MOBILE_E2E_DIR/api.db"
export APP_ENV=test EMAIL_BACKEND=disabled SEED_DEMO_ACCOUNTS=true
python -m alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Puis depuis `mobile` :

```bash
MOBILE_TEST_API_URL=http://127.0.0.1:8001/api npm run test:integration
```

Ce scénario simule une réponse perdue après commit, un rechargement du moteur, l'envoi de fiches liées et un conflit réel avec le backend. Il ne doit pas être pointé vers une base utilisée par de vrais agents.

## Test sur téléphone à effectuer

Les bundles et l'autolinking ont été vérifiés dans l'environnement cloud ; les tests JS simulent les ponts natifs. Le SDK Android, un émulateur et Xcode n'y sont pas disponibles : aucun APK ni exécution sur appareil n'a été validé.

Avant diffusion : installer sur un appareil, créer citoyen puis acte en mode avion, fermer complètement et rouvrir l'application, rétablir le réseau et vérifier l'absence de doublon. Vérifier aussi le trousseau après redémarrage, l'expiration, les conflits, le manque d'espace et les changements d'affectation. Les sauvegardes système/restaurations et les gros volumes nécessitent une validation sur les appareils ciblés.
