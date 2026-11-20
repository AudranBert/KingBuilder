# Cartes de départ

`maps/` contient un fichier JSON par carte, partagé par le navigateur et le serveur
de jeu. `maps/index.json` liste les noms des fichiers (sans extension) dans l’ordre
du catalogue. Pour ajouter une carte, créer son fichier puis ajouter son nom à cet index.

- `maps/new_land.json` : Nouveau monde (identifiant stable `base`).
- `maps/clearings.json` : Les clairières.
- `maps/valley.json` : La vallée.
- `maps/islands.json` : Îlot (identifiant stable `islands`).

Chaque carte a un `id` stable, un `name` et une `description` en français et anglais,
une `legend` et une liste de `zones`.

## Conception

Une carte développe une idée de gameplay spécifique, avec une dizaine de cases
préplacées au maximum, drapeaux compris, hors départs des royaumes. Le reste doit
être exploré pendant la partie. Cette cible est une règle de conception, pas un
blocage du chargement des fichiers modifiés par l’utilisateur.

- Nouveau monde : cinq objectifs, sans terrain supplémentaire (5 cases).
- Les clairières : deux paires de forêts pour amorcer la production de bois (9 cases).
- Îlot : trois drapeaux, dont un sur une île centrale de deux cases entourée d’eau ; accès par un pont (10 cases).
- La vallée : conserver la disposition de montagnes et de drapeaux éditée par l’utilisateur.

## Format

Une zone décrit un motif en cases :

```json
{ "anchor": [0.5, 0.5], "offset": [-1, -1], "rows": ["FPF", "P!P", "FPF"] }
```

- `anchor` situe la zone entre 0 et 1 sur chaque axe du plateau.
- L'origine est `floor(anchor × (taille − 1)) + offset`, sur chaque axe.
- Chaque caractère de `rows` correspond à une case de la légende.
- `.` laisse la case vide ; `!` pose un drapeau neutre sur le terrain associé.
- Les motifs gardent leur taille et leurs adjacences. Les grandes cartes ajoutent
  de l'espace à explorer plutôt que des terrains agrandis.
- `variants["9"].zones`, par exemple, remplace toutes les zones pour un plateau
  de 9 cases de côté. Les variantes héritent de la légende de la carte.

Les zones ne doivent ni se chevaucher, ni sortir du plateau, ni empiéter sur les
donjons et leurs accès. Ces cas provoquent une erreur explicite. Vérifier chaque
taille autorisée : 9, 11 et 13 avec `node --test tests/maps.test.js` après édition.

Le menu sélectionne « Nouveau monde » (`mapId: "base"`, fichier `new_land.json`)
par défaut. Le choix « Carte aléatoire » envoie `mapId: "random"` ; le moteur
choisit alors une carte du catalogue et conserve son véritable identifiant
dans la partie sauvegardée.
La draft initiale est réglable de 0 à 2 tuiles par joueur, avec 0 par défaut.
Elle s’ajoute à la carte choisie avant le premier tour. Le système de préplacement
aléatoire a été supprimé. La carte `base`, affichée « Nouveau monde », reprend uniquement les cinq drapeaux
du plateau d’origine et les départs des royaumes. Ses variantes conservent les
positions proportionnelles, avec les drapeaux placés en miroir autour du centre
pour conserver les symétries horizontale et verticale à toutes les tailles.
Les anciens appels sans réglages ou avec des réglages explicites de préparation
restent disponibles pour les scénarios et clients antérieurs.
