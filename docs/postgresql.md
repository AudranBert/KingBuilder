# Stockage PostgreSQL optionnel

Avec PostgreSQL, le menu affiche les 30 dernières parties terminées sous le catalogue. L’API publique `/history` expose uniquement les pseudos, scores, vainqueurs et dates. Les résumés sont conservés dans `kingbuilder_history`, indépendamment de l’expiration des salons. Aucun jeton ni état privé n’y figure. Sans BDD, cette section est masquée. Il s’agit d’un historique commun aux visiteurs du jeu, pas d’un historique personnel par compte.

Installer les dépendances avec `npm ci`. Sans `DATABASE_URL`, le serveur fonctionne en mémoire comme décrit dans [le guide multijoueur](multiplayer.md).

Pour conserver les parties lors des redémarrages, ajouter la variable secrète `DATABASE_URL` dans Render : utiliser l’URI PostgreSQL fournie par votre hébergeur. Avec Supabase, choisir une connexion compatible avec le réseau du serveur (notamment le Session pooler IPv4), copier son URI et remplacer le mot de passe (encoder ses caractères spéciaux dans l’URL). Conserver les paramètres TLS fournis par l’hébergeur. Ne jamais placer cette URI dans Git, le frontend ou `online-config.json`.

Le serveur crée sa table et son index au démarrage. L’utilisateur PostgreSQL doit disposer des droits de création dans le schéma choisi. Si la connexion échoue, le serveur refuse de démarrer ; il ne bascule pas silencieusement en mémoire. Les écritures sont transactionnelles, avec verrouillage par partie pour gérer les coups concurrents et les reconnexions. Le pilote `pg` est la seule dépendance de production ajoutée.

Les parties persistent jusqu’à leur expiration configurée (`ROOM_TTL_HOURS`, toujours 6 heures par défaut). Ce stockage conserve l’état courant et les derniers identifiants de commandes, pas un historique complet des coups. Les sauvegardes de la base restent à configurer chez l’hébergeur. Supprimer `DATABASE_URL` sélectionne le mode mémoire et ne supprime pas les données PostgreSQL existantes.

Les mêmes commandes de démarrage s’appliquent dans les deux modes. Un PostgreSQL standard sur VPS fonctionne avec la même URI. En mode PostgreSQL, plusieurs instances partagent les données et les verrous ; en mémoire, une seule instance doit être utilisée.

Pour exécuter le test d’intégration PostgreSQL, fournir `TEST_DATABASE_URL` pointant vers une **base de test**, puis lancer `node --test tests/postgres.test.js`. Le test crée un salon puis le supprime ; il vérifie la reprise, les doubles entrées simultanées, les commandes répétées et le rollback des coups invalides.
