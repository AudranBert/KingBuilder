# Configuration de KingBuilder

Modifier les JSON, puis lancer `npm run check:config` et `npm run build`. Commencer une nouvelle partie après toute modification des catalogues ou des règles.

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `game-rules.json` | Dimensions, durée, départ, drapeaux, marchés, portée, or et commerce |
| `resources.json` | Matériaux (`material`), nourriture (`food`), or (`gold`) |
| `units.json` | Roi, ouvrier, soldat et émissaire |
| `buildings.json` | Coûts, motifs, production, garnisons et points |
| `terrain-tiles.json` | Dix-sept formes et soixante tuiles prédéfinies, de deux à six cases |
| `terrains.json` | Terrains, traversabilité et apparence |
| `missions.json` | Missions communes, contribution et récompenses en or |

## Partie

- `boardSize` : 13 par défaut, pour un centre exact et des objectifs symétriques.
- `turnLimit` : 25 tours par joueur.
- `players` : deux royaumes et leurs positions initiales relatives entre 0 et 1.
- `startingWorkers` : ouvriers initiaux disponibles.
- `flags` : cinq coordonnées entières absolues `{ "x": 6, "y": 6 }`, à l’intérieur du plateau et sans doublon. Ces cases sont révélées sur plaine.
- `scoring.flag` : points de chaque drapeau contrôlé (4).
- `scoring.building` : valeur de repli des bâtiments sans champ `points` (1).
- `scoring.goldPerPoint` : nombre de pièces d’or pour 1 point au décompte final (2).
- `trade.basePrice` : prix de base d’une ressource achetée à la banque (2).
- `trade.producerSurcharge` : supplément par producteur adverse de la ressource (1).
- `trade.singleTerrainCost` : prix d’une case de terrain choisie à l’unité (1 or).
- `gold.firstPlayerStartingAmount` / `gold.startingAmount` : supplément d’or initial du premier / second joueur (0 / 1), ajouté à l’or de `resources.json`.
- `gold.rerollCost` / `gold.rerollLimitPerTurn` : coût et quota commun des relances (1 / 1).
- `placement.constructionRange` : portée orthogonale de construction (1).
- `placement.explorationContactDistance` : distance de contact d’une tuile explorée (1).
- `markets.terrainSize` / `markets.buildingSize` : nombre d’offres (4 / 4). Au départ, seules les trois cases directement voisines par un bord de chaque donjon sont révélées en plaine, sans les diagonales.
- `markets.initialMaxTier` : niveau exact au départ (1), puis niveau maximal avant le déblocage avancé. Le marché initial doit contenir des familles différentes ; prévoir assez de familles de ce niveau. La maison est de niveau 2.
- `markets.advancedFromReplacement` : remplacement partagé à partir duquel les bâtiments avancés entrent (2).

Le score final utilise les bâtiments, les drapeaux et l’or restant. La population et le prestige n’existent plus.

## Ressources

Chaque entrée contient `id`, `name`, `icon`, `startingAmount` et `points` (0 pour les trois ressources actuelles). Les coûts sont des objets tels que `{ "food": 1, "material": 2 }`. Les identifiants historiques bois, pierre, blé et fer ne sont plus utilisés comme ressources.

## Unités

- `king` : `recruitment: "initial"`, coût vide et 3 déplacements.
- `worker` : `recruitment: "house"`, coût vide, 0 déplacement ; affectation directe.
- `soldier` : `recruitment: "building"`, coût de 2 nourritures et 3 déplacements ; armées et combat.
- `emissary` : `recruitment: "building"`, coût vide car inclus dans la Chancellerie, 3 déplacements ; construction et exploration.

Les comportements militaires et les retours des bâtisseurs sont attachés à ces rôles. Ajouter une entrée à `units.json` ne suffit pas à créer une nouvelle règle de combat.

## Bâtiments

Champs communs : `id`, `name`, `icon`, `cost`, `terrain`, `description`, `pattern`, `layout`, `legend`, `tier`, `weight` et `points`. Garder `description` courte ; l’interface affiche des pictogrammes pour les effets connus.

Répartition actuelle de `tier` : 0 pour défrichement, pont et tunnel, 1 pour les fermes, scieries, carrières, mines et pêcheurs, 2 pour les ports et tous les autres bâtiments, y compris les moulins et avant-postes. Le donjon reste hors pioche.

`layout` dessine l’empreinte : `B` est la case réelle du bâtiment, les points sont des vides, les autres symboles renvoient à `legend`. L’empreinte doit être reliée par les bords et contenir exactement un `B`. Chaque symbole annexe indique ses terrains et son rôle. La rotation s’applique autour de `B`.

```json
{
  "id": "example",
  "name": "Atelier",
  "icon": "assets/textures/buildings-sawmill.svg",
  "cost": {"material": 2},
  "terrain": ["plain"],
  "description": "+1 matériau / tour.",
  "pattern": "Deux plaines adjacentes.",
  "layout": ["Bc"],
  "legend": {"c": {"terrain": ["plain"], "role": "courtyard"}},
  "produces": "material",
  "production": 1,
  "tier": 1,
  "weight": 2,
  "points": 1
}
```

Effets :

- `produces` + `production` : ressource et quantité avec un ouvrier.
- `grantsWorker` : ouvriers ajoutés immédiatement à la construction.
- `onBuildUnit` : unité offerte sur la case du bâtiment, grisée jusqu’au prochain tour.
- `trains` + `trainingLimit` : recrutements payants et quota par tour du propriétaire.
- `unique` : limite à un bâtiment et son émissaire par joueur.
- `garrison` : garnison fixe (1 dans les règles actuelles).
- `traversable` : rend la case praticable, notamment pont, tunnel et avant-poste.
- `boost` : producteur ciblé, multiplicateur, voisinage `edge` ou `touching`, propriété requise.
- `adjacency` : conditions de voisinage d’un bâtiment ou rôle annexe.
- `transformTo` + `onBuildGain` : action de transformation d’une case, sans bâtiment permanent.
- `constructible: false` : bâtiment initial hors pioche (donjon).
- `family` : variante d’un bâtiment de base, notamment pour les missions et bonus.

L’avant-poste accepte tous les terrains révélés sans bâtiment, y compris un drapeau ou une annexe compatible. Sur un drapeau, sa garnison en prend le contrôle. Sa case devient praticable.

`deckSize` correspond à la pioche, actuellement 89. `weight` indique les exemplaires ; `maxFamilyCopies` limite une famille à 12 cartes, variantes comprises. Le donjon reste hors pioche.

Quantités par famille, variantes comprises : défrichement 8 ; autres niveaux 0 (pont et tunnel) 6 chacun ; niveaux 1 6 chacun ; niveaux 2 5 chacun, sauf maison 7, caserne 6 et avant-poste 6. Le donjon initial reste hors pioche. Les 5 ports se répartissent en 2 de base, 2 carrés et 1 en L ; les 6 pêcheurs en 2 par motif. Les pêcheurs coûtent 1 matériau et produisent 1 nourriture par tour avec un ouvrier. Motifs : `rrr` (bateau sur une extrémité en rivière), `prr` et `rr / xp` (cabane sur la plaine) ; `r` = rivière, `p` = plaine portant le bâtiment, `x` = case ignorée.

## Missions

Trois missions communes, 48 variantes réparties en trois difficultés. Chaque famille doit avoir une variante par niveau et des seuils croissants.

Champs : `id`, `name`, `metric`, `target`, `family`, `difficulty`, `reward: {"gold": 1}`. Selon la métrique, préciser `terrain`, `building` ou `resource`.

- `revealed` : cases révélées cumulées, éventuellement d’un terrain précis.
- `built` : constructions cumulées ; les variantes contribuent à leur famille.
- `recruited` : ouvriers obtenus après le départ.
- `resources` : stock actuel d’une ressource ou somme des stocks.

Chaque offre impose une contribution après son apparition : le seuil individuel est le maximum entre `target` et le compteur à l’apparition plus `requiredContribution`. Cela empêche les récompenses en cascade sans nouveau progrès. Une mission attribuée est remplacée par une mission du niveau suivant, jusqu’à `maxDifficulty`.

Les noms historiques de certaines missions sont conservés comme identifiants de catalogue ; leur ressource est toujours déterminée par le champ `resource` actuel.
