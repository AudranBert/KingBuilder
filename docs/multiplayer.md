# Multijoueur privé temporaire

Le lobby permet de choisir un temps maximum par tour : sans limite par défaut, ou entre 30 secondes et 3 minutes. La préparation n’est pas chronométrée. Le serveur termine automatiquement les tours expirés lors de la prochaine lecture ou action (les clients consultent l’état toutes les deux secondes). L’horloge continue lors d’une déconnexion ; en mode PostgreSQL son échéance persiste après redémarrage. Quitter une partie en cours via le bouton d’abandon donne la victoire à l’autre joueur et affiche les scores de fin de partie.

**Stockage optionnel disponible :** renseigner `DATABASE_URL` pour conserver les parties dans PostgreSQL. Voir [la configuration PostgreSQL](postgresql.md). Les limitations de perte au redémarrage et d’instance unique décrites ci-dessous concernent uniquement le mode mémoire. Installer les dépendances avec `npm ci` avant de démarrer.

Le frontend reste statique (GitHub Pages). Le backend Node.js valide chaque commande avec le moteur partagé, conserve les salons en mémoire et ne transmet jamais les pioches ni les jetons adverses. Aucune dépendance npm supplémentaire, aucun compte joueur ni base de données.

## Développement

Node.js 22 recommandé. Dans deux terminaux :

```sh
npm start
npm run start:online
```

Ouvrir http://127.0.0.1:4173 dans deux navigateurs ou deux onglets. Créer une partie en ligne dans le premier, saisir son code dans le second. Chaque onglet garde son accès dans `sessionStorage` ; le dernier accès est aussi conservé dans `localStorage` pour récupérer une fermeture accidentelle. « Reprendre ma partie » est activé seulement après vérification d’une partie inachevée sur le serveur. Une partie terminée, abandonnée ou expirée est retirée des reprises ; une coupure réseau temporaire conserve l’accès. Le lien préremplit le code ; cliquer Rejoindre confirme l’entrée. Les jetons ne sont jamais inclus dans les invitations.

Pendant une partie en ligne, « Abandonner la partie » est un abandon définitif, et non une mise en pause. Une reprise reste possible après une interruption tant que le salon existe sur le serveur ; le chronomètre éventuel continue de s’appliquer.

## Render gratuit

1. Pousser le code dans le dépôt GitHub.
2. Dans Render, créer un **Blueprint** depuis ce dépôt et sélectionner la branche contenant `render.yaml` (idéalement `main`). Ce fichier configure un service gratuit, le port fourni par Render, le contrôle de santé et le déploiement automatique.
3. Copier l’URL HTTPS attribuée au service, par exemple `https://kingbuilder-multiplayer.onrender.com`.
4. Remplacer `apiUrl` dans `public/online-config.json` par cette URL et pousser sur `main` pour publier le frontend.
5. Vérifier `/health`, puis créer et rejoindre une partie depuis deux appareils.

Dans Render, `ALLOWED_ORIGINS` doit contenir l’origine du frontend, sans chemin ni slash final : `https://audranbert.github.io`. Séparer plusieurs origines par des virgules. Ne jamais mettre `/KingBuilder/` dans cette variable.

## Configuration et exploitation

| Variable du serveur | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `3001` | Port HTTP (fourni automatiquement par Render) |
| `ALLOWED_ORIGINS` | localhost et 127.0.0.1 sur 4173 | Origines autorisées |
| `MAX_ROOMS` | `200` | Nombre maximum de salons en mémoire |
| `ROOM_TTL_HOURS` | `6` | Expiration après le dernier coup ou l’entrée du second joueur |

Le frontend récupère l’état toutes les deux secondes. Une seule commande est envoyée à la fois ; le serveur contrôle le joueur, la révision et les doublons. Une erreur réseau déclenche une récupération de l’état confirmé. Les sélections sont locales. L’annulation est désactivée en ligne.

Les salons sont temporaires : redémarrage, mise en veille ou déploiement serveur suppriment les parties. Le serveur Render gratuit peut prendre environ une minute à se réveiller ; le client attend jusqu’à 75 secondes. Il n’y a pas de compte administrateur : les journaux, redémarrages et variables se gèrent dans Render. Un redémarrage vide tous les salons. Une seule instance doit tourner, car l’état est en mémoire. Les limites HTTP sont appliquées par adresse de connexion (elles peuvent être partagées derrière un proxy).

Déployer frontend et backend ensemble lors d’un changement des règles. Pour des parties persistantes, remplacer le stockage `Rooms` par PostgreSQL ; pour un VPS, exécuter `npm run start:online` avec un gestionnaire de processus et un reverse proxy HTTPS. Garder l’URL du frontend dans `ALLOWED_ORIGINS` et modifier uniquement `apiUrl` lors du déplacement du backend.

## Modifier et vérifier

`src/commands.js` définit la liste des actions autorisées. `backend/rooms.mjs` gère les salons, accès et révisions. `backend/server.mjs` expose l’API HTTP. `src/online.js` gère le transport, la reprise et le polling. `src/app.js` relie ces commandes à l’interface existante.

```sh
npm test
npm run check:config
npm run build
```
