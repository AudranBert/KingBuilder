# Configuration de KingBuilder

Modifier les JSON, puis lancer `npm run check:config` et `npm run build`. Commencer une nouvelle partie après toute modification des catalogues ou des règles.

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `game-rules.json` | Dimensions, durée, départ, drapeaux, marchés, portée, or et commerce |
| `resources.json` | Matériaux (`material`), nourriture (`food`), or (`gold`) |
| `units.json` | Ouvrier mobile et soldat |
| `buildings/index.json` | Liste des fichiers de bâtiments et paramètres de pioche |
| `buildings/<famille>.json` | Bâtiment de base et toutes ses variantes : coûts, motifs, production, garnisons et points |
| `terrain-tiles/index.json` | Taille de pioche, légende des terrains et liste des fichiers par taille |
| `terrain-tiles/<taille>.json` | Formes et tuiles prédéfinies de cette taille : `2.json`, `3.json`, `4.json`, `5.json` |
| `terrains.json` | Terrains, traversabilité et apparence |
| `missions/index.json` | Liste des catégories, marché, niveaux et contribution requise |
| `missions/<catégorie>.json` | Les trois niveaux d'une même mission, avec leurs seuils et récompenses |

## Partie

- `boardSize` : 13 par défaut, pour un centre exact et des objectifs symétriques.
- `turnLimit` : 25 tours par joueur.
- `players` : deux royaumes et leurs positions initiales relatives entre 0 et 1.
- `startingWorkers` : deux ouvriers mobiles au donjon au départ.
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

- `worker` : `recruitment: "house"`, coût vide et 3 déplacements ; une action parmi explorer, construire ou produire. Les déplacements peuvent précéder et suivre l’action.
- `soldier` : `recruitment: "building"`, coût de 2 nourritures et 3 déplacements ; armées et combat.

Les maisons coûtent 3 nourritures et 3 matériaux. Leur ouvrier apparaît sur la maison, actif au tour suivant. Un ouvrier capturé revient au donjon et est actif à son prochain tour.

L’action Produire gagne immédiatement 1 nourriture sur une plaine libre, 1 matériau sur une forêt libre ou la production du bâtiment occupé et possédé. Un bâtiment producteur peut être activé une seule fois par tour ; les ouvriers dont l’action reste disponible produisent automatiquement à la fin du tour. Les producteurs standards donnent 2 ressources. Les moulins ajoutent +1, sans cumul.

Les comportements militaires et les retours des bâtisseurs sont attachés à ces rôles. Ajouter une entrée à `units.json` ne suffit pas à créer une nouvelle règle de combat.

## Tuiles de terrain

Chaque fichier de `terrain-tiles/` regroupe les formes (`shapes`) et les tuiles (`tiles`) d'une même taille. Par exemple, `3.json` contient toutes les formes et tuiles de trois cases. Les points dans un motif représentent des cases ignorées et ne comptent pas dans la taille.

`terrain-tiles/index.json` contient `deckSize`, la légende commune `legend` et `files`, la liste des noms de fichiers sans extension (`"2"`, `"3"`, `"4"`, `"5"`). Pour ajouter une taille, créer son fichier et ajouter son nom à `files`. Pour ajouter une tuile, la placer dans le fichier de sa taille avec une référence `shapeId` vers une forme du même fichier, puis ajuster `deckSize`.

## Bâtiments

Chaque fichier de `buildings/` contient un tableau avec le bâtiment de base et toutes ses variantes. Par exemple, `buildings/farm.json` regroupe `farm`, `farm_z` et `farm_t`. Les variantes gardent leur champ `family` et leur identifiant propre. Les bâtiments sans variante ont un tableau d'une seule entrée.

`buildings/index.json` contient `deckSize`, `startingBuilding`, `maxFamilyCopies` et `files` : la liste des noms de fichiers sans extension, dans leur ordre de chargement. Pour ajouter une famille, créer son fichier puis ajouter son nom à `files`. Pour ajouter une variante, la placer dans le fichier de sa famille. Le nom du fichier doit correspondre à l'identifiant du bâtiment de base.

Champs communs : `id`, `name`, `icon`, `cost`, `terrain`, `description`, `pattern`, `layout`, `legend`, `tier`, `weight` et `points`. Garder `description` courte ; l’interface affiche des pictogrammes pour les effets connus.

Répartition actuelle de `tier` : 0 pour défrichement, pont et tunnel, 1 pour les fermes, scieries, carrières, mines et pêcheurs, 2 pour les ports et tous les autres bâtiments, y compris les moulins et tours. Le donjon reste hors pioche.

`layout` utilise le même alphabet pour tous les bâtiments : `B` (ou `b`) = bâtiment à poser, `c` = bâtiment voisin existant hors pont et tunnel, `p` = plaine, `f` = forêt, `m` = montagne, `r` = rivière, `w` = champ de blé, `l` = rive sur plaine ou forêt, `.` = case ignorée. Aucun objet `legend` ni `role` n’est nécessaire. Le pattern doit contenir exactement un `B` ; ses conditions peuvent être séparées par des points. La rotation s’applique autour de `B`.

`!` devant une lettre de terrain signifie « tout sauf ce terrain » : `!p` exclut la plaine. Chaque expression compte pour une seule case. Exemple vertical : `"layout": ["!p", "B", "!p"]` ; exemple horizontal : `["!pB!p"]`. Un seul `B` est autorisé.

Les autres cases ne sont ni réservées ni attribuées au bâtiment. Plusieurs patterns peuvent partager ces cases, même si elles portent déjà un autre bâtiment. La production de terrain et les déplacements restent possibles selon le terrain. Les champs autour des fermes sont un affichage et une condition de placement dérivés des fermes présentes ; ils ne réservent pas les plaines. Le passage du grand pont reste franchissable sans réserver sa seconde case d’eau. Les anciennes réservations `overlay` sont supprimées au chargement.

```json
{
  "id": "example",
  "name": "Atelier",
  "icon": "assets/textures/buildings/sawmill.svg",
  "cost": {"material": 2},
  "terrain": "plain",
  "description": "+1 matériau / tour.",
  "pattern": "Deux plaines adjacentes.",
  "layout": ["Bp"],
  "produces": "material",
  "production": 1,
  "tier": 1,
  "weight": 2,
  "points": 1
}
```

Effets :

- `produces` + `production` : ressource et quantité par action Produire.
- `grantsWorker` : ouvriers ajoutés sur le bâtiment, actifs au prochain tour.
- `onBuildUnit` : unité offerte sur la case du bâtiment, grisée jusqu’au prochain tour.
- `trains` + `trainingLimit` : recrutements payants et quota par tour du propriétaire.
- `unique` : limite à un bâtiment par joueur.
- `garrison` : garnison fixe (1 dans les règles actuelles).
- `traversable` : rend la case praticable, notamment pont, tunnel et tour.
- `boost` : producteur ciblé, bonus additif, voisinage `edge` ou `touching`, propriété requise.
- `c` dans le layout : bâtiment voisin requis.
- `transformTo` + `onBuildGain` : action de transformation d’une case, sans bâtiment permanent.
- `constructible: false` : bâtiment initial hors pioche (donjon).
- `family` : variante d’un bâtiment de base, notamment pour les missions et bonus.

La tour accepte tous les terrains révélés sans bâtiment, y compris un drapeau ou une annexe compatible. Sur un drapeau, sa garnison en prend le contrôle. Sa case devient praticable.

`deckSize` correspond à la pioche, actuellement 84. `weight` indique les exemplaires ; `maxFamilyCopies` limite une famille à 12 cartes, variantes comprises. Le donjon reste hors pioche.

Quantités par famille, variantes comprises : défrichement 8 ; autres niveaux 0 (pont et tunnel) 6 chacun ; niveaux 1 6 chacun ; niveaux 2 5 chacun, sauf maison 7, caserne 6 et tour 6. Le donjon initial reste hors pioche. Les 5 ports se répartissent en 2 de base, 2 carrés et 1 en L ; les 6 pêcheurs en 2 par motif. Les pêcheurs coûtent 1 matériau et produisent 2 nourritures par action Produire. Motifs : `rrr` (bateau sur une extrémité en rivière), `prr` et `rr / xp` (cabane sur la plaine) ; `r` = rivière, `p` = plaine portant le bâtiment, `x` = case ignorée.

## Missions

Trois missions communes, 48 variantes réparties en trois difficultés. Chaque famille doit avoir une variante par niveau et des seuils croissants.

Chaque fichier de `missions/` contient un tableau avec les trois versions d'une même catégorie, dans l'ordre des difficultés 1, 2 et 3. Par exemple, `missions/revealed-mountain.json` regroupe les missions demandant de révéler 3, 6 et 9 montagnes. Le nom du fichier correspond au champ `family` de ses missions.

`missions/index.json` contient `marketSize`, `initialDifficulty`, `maxDifficulty`, `requiredContribution` et `files`, la liste des fichiers sans extension. Pour ajouter une catégorie, créer son fichier avec les trois niveaux puis ajouter son nom à `files`.

Champs : `id`, `name`, `metric`, `target`, `family`, `difficulty`, `reward: {"gold": 1}`. Selon la métrique, préciser `terrain`, `building` ou `resource`.

- `revealed` : cases révélées cumulées, éventuellement d’un terrain précis.
- `built` : constructions cumulées ; les variantes contribuent à leur famille.
- `recruited` : ouvriers obtenus après le départ.
- `resources` : stock actuel d’une ressource ou somme des stocks.

Chaque offre impose une contribution après son apparition : le seuil individuel est le maximum entre `target` et le compteur à l’apparition plus `requiredContribution`. Cela empêche les récompenses en cascade sans nouveau progrès. Une mission attribuée est remplacée par une mission du niveau suivant, jusqu’à `maxDifficulty`.

Les noms historiques de certaines missions sont conservés comme identifiants de catalogue ; leur ressource est toujours déterminée par le champ `resource` actuel.
