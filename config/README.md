# Configurer KingBuilder

Les sept fichiers JSON de ce dossier sont lus au démarrage du jeu. Ils peuvent être modifiés dans un éditeur de texte ; aucun changement du moteur n’est nécessaire pour ajouter des terrains, des formes, des ressources, des unités ou des bâtiments utilisant les effets décrits ci-dessous.

Après une modification, lancer `npm run check:config`, recharger la page et commencer une nouvelle partie pour reconstruire les pioches. Une version publiée doit être republiée pour recevoir les modifications locales. Utiliser des guillemets doubles, sans commentaires ni virgule après la dernière entrée.

## `terrain-tiles.json` — formes des terrains

Chaque forme possède un `id` unique, un `name`, un `weight` et un `pattern` :

```json
{
  "id": "t5",
  "name": "T de 5",
  "weight": 1,
  "pattern": [
    "xxx",
    ".x.",
    ".x."
  ]
}
```

- `x` : case de terrain ; `.` : vide, qui ne réserve aucune case.
- Les lignes se lisent du haut vers le bas. Leurs longueurs peuvent différer ; des points de fin sont facultatifs.
- Les cases doivent être reliées par un bord. Le moteur applique les quatre rotations.
- Les 13 formes actuelles contiennent au maximum 5 cases. **Aucune limite mécanique de taille n’est imposée** : une forme plus grande peut être ajoutée dans ce fichier.
- `shapes` conserve les 13 formes modifiables. `weight` est un champ hérité validé, sans influence sur la fréquence du catalogue.
- `deckSize` correspond exactement au nombre d’entrées dans `tiles` : 60 actuellement. Chaque entrée est présente une fois dans la pioche.
- `legend` associe les lettres aux identifiants de `terrains.json` : `P` = plaine, `F` = forêt, `M` = montagne, `R` = rivière. `.` reste du vide.
- `tiles` définit les terrains exacts de chaque tuile. Seul l’ordre de la pioche est mélangé ; aucun terrain n’est tiré au hasard.

```json
{
  "id": "filon-accessible",
  "name": "Filon accessible",
  "shapeId": "line4",
  "pattern": ["PMMM"],
  "intent": "Motif complet de mine"
}
```

`id` est unique et stable. `shapeId` référence une forme de `shapes`. `pattern` doit respecter exactement ses cases et ses vides. `intent` est une note facultative de conception. Pour ajouter une tuile, copier une entrée dans `tiles`, modifier son identifiant et ses terrains, puis augmenter `deckSize`. Pour ajouter une nouvelle forme, ajouter d’abord sa définition dans `shapes`, puis une ou plusieurs tuiles qui la référencent. Aucune limite mécanique de cinq cases n’est introduite.

Le [catalogue des 60 tuiles](tile-catalogue.md) montre les motifs et leur intérêt prévu. Les dispositions sont cohérentes à l’intérieur de chaque tuile ; aucune continuité automatique entre les rivières de deux tuiles n’est imposée. Les joueurs choisissent comment les raccorder.

Les parties en cours gardent leurs tuiles déjà tirées. **Commencer une nouvelle partie pour utiliser le catalogue de 60 tuiles.**

## `terrains.json` — types de terrain

La liste `terrains` contient les quatre terrains actuels : `plain`, `forest`, `mountain` et `river`. Exemple d’entrée à ajouter :

```json
{
  "id": "desert",
  "name": "Désert",
  "icon": "☀",
  "walkable": true,
  "color": "#dfc58c",
  "foreground": "#8e703a"
}
```

- `id` : identifiant unique et stable, référencé par les tuiles et les contraintes des bâtiments.
- `name` et `icon` : nom et symbole utilisés dans l’interface et la légende.
- `walkable` : `true` autorise les déplacements, `false` les bloque. Un bâtiment avec `traversable: true`, comme le pont, permet de traverser sa case.
- `color` et `foreground` : couleurs du fond et du symbole, au format hexadécimal `#RGB` ou `#RRGGBB`.

Pour utiliser le nouveau terrain, lui attribuer une lettre dans `legend` de `terrain-tiles.json`, puis placer cette lettre dans les motifs de `tiles`. Pour y construire, l’ajouter aux listes `terrain` des bâtiments concernés. Les noms, couleurs, symboles, déplacements et aperçus suivent automatiquement cette définition. Renommer ou supprimer un identifiant demande de mettre à jour toutes ses références ; commencer une nouvelle partie après un tel changement.

## `game-rules.json` — paramètres de partie et score

Les paramètres sont explicites et validés au chargement. Les champs manquants déclenchent une erreur de configuration.

| Champ | Rôle |
| --- | --- |
| `boardSize`, `turnLimit` | Taille du plateau et nombre de tours par joueur. |
| `startingWorkers` | Nombre d’ouvriers disponibles au départ. |
| `workerRecruitmentLimitPerTurn` | Nombre de recrutements directs autorisés par tour ; 0 désactive le recrutement. |
| `markets.terrainSize`, `markets.buildingSize` | Nombre d’offres dans chaque marché. |
| `markets.initialMaxTier` | Tier maximal avant le déblocage. |
| `markets.advancedFromReplacement` | Numéro du remplacement à partir duquel tous les tiers deviennent éligibles. Un achat ou une relance complète compte pour un remplacement. |
| `placement.constructionRange` | Distance maximale entre l’unité et l’entrée d’un bâtiment, sans diagonale ; 0 impose la case de l’unité. |
| `placement.explorationContactDistance` | Distance exigée entre l’unité et au moins une case explorée, sans diagonale. |
| `players` | Noms et positions relatives des deux royaumes. `start.x` et `start.y` sont entre 0 et 1 : 0 est le premier bord, 1 le dernier, 0.5 le milieu. Le mode solo prend la première entrée. |
| `scoring.tile`, `scoring.building` | Points par case révélée et par bâtiment. |
| `scoring.unit` | Coefficient commun aux points de toutes les unités, ouvriers et roi compris. |
| `scoring.resource` | Coefficient décimal appliqué au stock total pondéré par les `points` des ressources ; arrondi inférieur après multiplication. |
| `scoring.prestige` | Points par prestige restant. |
| `prestige` | Prestige initial, coût et quota des relances, coût du joker. |

Le coefficient actuel des ressources est **0.34** : 3 ressources valent 1 point, 6 valent 2 points et 100 valent 34 points. Il est utilisé directement ; aucun diviseur ni conversion implicite en tiers exact n’est appliqué. Quatre décimales au maximum sont acceptées. Les anciens champs `scoring.worker` et `scoring.resourceDivisor` sont refusés : utilisez les points dans `units.json` et le coefficient `resource`.

Les déplacements unitaires orthogonaux, la rotation par quarts de tour, l’action d’exploration ou de construction et les rôles des unités sont les mécanismes implémentés par le moteur. Les identifiants et les versions historiques des sauvegardes ne sont pas des paramètres d’équilibrage.

Modifier la taille du plateau exige une nouvelle partie ; une sauvegarde de dimensions incompatibles est conservée en copie. Le compteur de recrutement est sauvegardé et remis à zéro au changement de joueur. Pour une ancienne sauvegarde qui n’a que le booléen `recruited`, il est initialisé à 0 ou 1.

## `resources.json` — ressources

```json
{
  "id": "gold",
  "name": "Or",
  "icon": "●",
  "startingAmount": 0,
  "points": 1
}
```

Ajouter cet objet à la liste `resources` suffit pour que l’or soit initialisé dans les nouvelles parties et apparaisse dans l’interface. Il devient utilisable dans les coûts et productions des bâtiments.

- `id` : identifiant stable utilisé dans les coûts, productions et sauvegardes.
- `name` : nom affiché ; `icon` : symbole affiché.
- `startingAmount` : quantité initiale par joueur.
- `points` : points de fin de partie par unité restante.
Le coût de recrutement de l’ouvrier est défini dans `units.json`, entrée `worker`, champ `cost`. Le champ `recruitmentCost` dans `resources.json` est refusé pour éviter deux sources de configuration.

Modifier un nom ou un symbole n’exige pas de changer les références. Modifier un identifiant exige de mettre à jour tous les coûts et productions qui l’utilisent. Supprimer une ressource encore référencée déclenche une erreur explicite. Une ressource ajoutée à une partie existante commence à 0 ; les nouvelles parties utilisent `startingAmount`.

La population est une ressource calculée (`"calculated": "population"`) : sa valeur affichée correspond aux places occupées et à la capacité de logement. Elle n’est ni stockée ni dépensable. La pièce d’or (`gold`) est une ressource stockable initialisée à 0, réservée aux futurs coûts et échanges avec le prestige.

## `buildings.json` — bâtiments, motifs et effets

Chaque entrée de `buildings` possède :

| Champ | Utilité |
| --- | --- |
| `id`, `name`, `icon` | Identifiant stable, nom et symbole. |
| `weight` | Fréquence relative dans la pioche. |
| `cost` | Ressources nécessaires, par exemple `{"wood": 2, "stone": 1}`. `{}` rend le bâtiment gratuit. |
| `terrain` | Liste des terrains autorisés sous son entrée. |
| `layout` | Dessin de sa tuile : `B` est l’entrée, `.` le vide, les autres lettres sont définies dans `legend`. |
| `legend` | Pour chaque lettre : terrains requis et rôle de la case auxiliaire. |
| `description` | Texte présentant l’effet. À maintenir à jour avec les valeurs. |
| `pattern` | Texte présentant les contraintes. À maintenir à jour avec `layout` et les conditions. |

Exemple de bâtiment ajouté produisant de l’or sur une plaine :

```json
{
  "id": "mint",
  "name": "Atelier monétaire",
  "icon": "●",
  "weight": 1,
  "cost": {"wood": 1, "stone": 2},
  "terrain": ["plain"],
  "layout": ["B"],
  "legend": {},
  "produces": "gold",
  "production": 1,
  "description": "1 or par tour avec un ouvrier.",
  "pattern": "Une case de plaine."
}
```

Ajouter aussi la ressource `gold` au fichier des ressources. Ce bâtiment fonctionnera avec la production, les coûts, l’affectation directe des ouvriers et le marché existants.

### Dessiner un motif

Exemple de la ferme :

```json
"layout": [".f.", "fBf", ".f."],
"legend": {"f": {"terrain": ["plain"], "role": "field"}}
```

Le `B` est toujours à la position du roi pour construire. Les coordonnées sont calculées relativement à ce `B`, puis tournées automatiquement. Il doit y avoir exactement un `B`. Toutes les cases occupées doivent être reliées, explorées, libres et correspondre au terrain demandé. Les points restent disponibles. Les motifs de bâtiments n’ont pas non plus de limite mécanique de taille.

Les rôles actuels sont `field` (champ), `mine` et `water` ; d’autres noms sont possibles. Le rôle `building` est réservé à `B`. Toutes les cases auxiliaires sont réservées par le bâtiment ; une tuile reste un seul bâtiment au score et un seul poste d’ouvrier, quelle que soit sa taille.

### Effets disponibles

- `produces` et `production` : ressource et quantité produites en fin de tour avec un ouvrier.
- `housing` : nombre de places ajoutées à la capacité totale des maisons.
- `traversable: true` : sa case principale devient praticable même sur un terrain infranchissable, comme le pont.
- `adjacentOn: ["river"]` : autorise la construction sur une case voisine du roi quand le terrain de l’entrée appartient à cette liste. Sans ce champ, l’entrée doit être sous le roi.
- `transformTo: "plain"` : action qui transforme le terrain de l’entrée et ne laisse aucun bâtiment, comme le défrichement. Réservée aux motifs d’une seule case, sans production, logement ni bonus.
- `adjacency` : liste de conditions de voisinage, toutes obligatoires. Chaque condition cible `building` (identifiant d’un bâtiment) **ou** `role` (rôle d’une case auxiliaire). `range: "edge"` = un bord ; `range: "touching"` = bord ou coin ; `owned: true` = appartient au joueur actif.
- `boost` : bonus passif appliqué aux producteurs voisins. `target` désigne le bâtiment cible, `multiplier` son multiplicateur, `range` la portée et `owned` le besoin d’un propriétaire commun. Les bonus ne se cumulent pas : le plus fort s’applique. Le producteur doit toujours avoir un ouvrier.

Le moulin existant donne un exemple combinant `adjacency` et `boost`.

`deckSize` fixe la taille de la pioche des bâtiments (66 actuellement). `startingBuilding` désigne le bâtiment de départ de chaque joueur ; il doit fournir des logements. Ajouter un bâtiment avec un effet complètement nouveau, absent de cette liste, demande encore de programmer cet effet dans le moteur.

## Sauvegardes et erreurs

Les pioches déjà mélangées sont conservées : commencer une nouvelle partie après avoir changé les définitions est recommandé. Les identifiants stables permettent de garder les bâtiments existants. Retirer un bâtiment déjà construit rend la sauvegarde incompatible : le navigateur en garde une copie sous `kingbuilder-save-v1-backup` avant de créer la nouvelle partie. Les ressources acquises sont conservées dans les parties compatibles.

Une erreur de JSON ou de référence empêche le démarrage avec un message qui indique le fichier et le champ concernés. `npm run check:config` permet de la repérer avant de lancer le jeu.

## `units.json` — roi, ouvriers et unités recrutables

Le fichier `units.json` contient une liste `units`. Les entrées `king` et `worker` sont obligatoires ; elles conservent leurs mécaniques spécifiques. Les autres entrées définissent les unités contrôlables recrutées dans les bâtiments :

```json
{
  "id": "cavalry",
  "name": "Cavalier",
  "icon": "➶",
  "cost": {"iron": 1, "wheat": 1},
  "moves": 3,
  "population": 1,
  "points": 0,
  "recruitment": "building"
}
```

Les unités contrôlables peuvent explorer ou construire comme le roi, avec leurs propres déplacements et leur action. `population` est le nombre de places consommées dans la capacité commune aux ouvriers et unités ; `points` fixe ses points directs avant multiplication par le coefficient commun `scoring.unit`. Les explorations et constructions sont toujours créditées au joueur.

Un bâtiment peut former ces unités avec `"trains": ["cavalry"]` et `"trainingLimit": 1`. La liste permet d’offrir plusieurs choix d’unités, partageant le même quota pour ce bâtiment. Le quota se renouvelle à chaque tour du propriétaire. Le recrutement ne demande pas d’ouvrier ; l’unité apparaît sur le bâtiment, épuisée jusqu’au prochain tour. Les coûts sont payés immédiatement et le logement doit être disponible.

Pour ajouter une unité, copier l’entrée du cavalier dans `units.json`, lui donner un nouvel `id` unique et modifier les valeurs souhaitées. Ajouter ensuite cet identifiant à `trains` dans la caserne ou dans un autre bâtiment formateur de `buildings.json`. Exemple : `"trains": ["cavalry", "scout"]` donne deux choix partageant le quota de la caserne. Le nom, le symbole, les coûts, les déplacements, la population et les points sont pris automatiquement dans `units.json`.

Pour modifier seulement une unité existante, éditer `units.json` : aucun changement du fichier des bâtiments n’est nécessaire tant que son identifiant ne change pas. Un changement d’identifiant ou une suppression demande de mettre à jour les références `trains`. Les erreurs sont détectées par `npm run check:config` ; les définitions d’unités dans `buildings.json` ne sont plus acceptées, afin de garder une seule source de configuration. Le roi reste le pion de départ du jeu et les ouvriers conservent leur système d’affectation directe.


## `missions.json` — objectifs communs et récompenses

Le fichier contient `marketSize: 3` et la liste `missions`. Chaque variante apparaît une fois dans la pioche mélangée. Les trois offres initiales sont toutes à ★. Dès qu’un joueur remplit une mission visible, elle lui est attribuée automatiquement, sa récompense est ajoutée et son emplacement reçoit un objectif aléatoire du niveau supérieur : ★ → ★★ → ★★★, puis ★★★ → ★★★. Les deux autres emplacements ne changent pas. Une variante déjà remportée ne revient pas. Quand il ne reste aucune carte au niveau requis, l’emplacement disparaît, sans revenir à une difficulté inférieure.

```json
{
  "id": "forest-3",
  "name": "Révéler 3 forêts",
  "family": "revealed-forest",
  "difficulty": 1,
  "metric": "revealed",
  "terrain": "forest",
  "target": 3,
  "reward": {"prestige": 1}
}
```

- `id` : identifiant unique et stable ; `name` : intitulé affiché au-dessus du plateau.
- `family` : identifiant commun aux trois versions d’un objectif ; `difficulty` : 1, 2 ou 3 étoiles. Chaque famille doit contenir exactement ces trois variantes, avec le même critère et des seuils strictement croissants.
- `target` : seuil entier positif ; `reward.prestige` : prestige gagné, entier positif librement modifiable par mission.
- `metric: "revealed"` : nombre de cases révélées depuis le début de la partie. Ajouter `terrain` pour compter uniquement ce terrain. Un défrichement ultérieur ne retire pas une forêt déjà révélée du compteur.
- `metric: "built"` : nombre de bâtiments construits. Ajouter `building` pour cibler un type, par exemple `"sawmill"`. La maison initiale et les actions de transformation du terrain ne comptent pas.
- `metric: "recruited"` : nombre d’ouvriers recrutés, hors ouvrier initial et unités militaires.
- `metric: "resources"` : quantité détenue au moment de la vérification. Ajouter `resource` pour cibler `wood`, `wheat`, etc. Sans ce champ, toutes les ressources sont additionnées. Le prestige est exclu.

La progression est cumulée depuis le début, même avant l’apparition de la mission, sauf les stocks qui correspondent aux ressources détenues. Seules les missions visibles peuvent être remportées. Chaque offre exige une progression après son apparition. Le seuil individuel est le maximum entre `target` et la progression du joueur à l’apparition plus un. Les stocks doivent dépasser leur valeur à l’apparition tout en atteignant `target`. Les vérifications suivent exploration, construction, recrutement et récolte, y compris la dernière récolte de la partie. Les récompenses ne sont pas des ressources et ne comptent pas pour les missions de stock.

Le catalogue initial contient 16 objectifs déclinés en 3 difficultés, soit 48 missions : explorations totales et par terrain, constructions totales et ciblées, recrutement d’ouvriers et réserves de ressources. Ajouter ou retirer un objectif se fait dans ce fichier, avec ses trois variantes, sans changer le moteur. Les terrains, ressources et bâtiments référencés doivent exister dans leurs fichiers respectifs. Commencer une nouvelle partie après modification du catalogue ; une ancienne sauvegarde qui référence une mission supprimée est conservée en copie avant remplacement.

### Paramètres de prestige dans `game-rules.json`

- `prestige.firstPlayerStartingAmount` : prestige de départ du premier joueur (0).
- `prestige.startingAmount` : prestige de départ du second joueur (1).
- `scoring.prestige` : points par prestige restant à la fin (3).
- `prestige.rerollCost` : coût d’une relance (1).
- `prestige.rerollLimitPerTurn` : quota commun aux deux marchés pour le joueur actif (1).
- `prestige.wildcardCost` : prestige nécessaire par ressource manquante pour acheter un bâtiment (1).

Une relance remplace tout le marché choisi, sans consommer l’action d’une unité. Les anciennes offres vont sous la pioche ; il faut assez de cartes en pioche pour fournir toutes les nouvelles offres. Le quota est remis à zéro au changement de joueur.

Le joker ne s’applique qu’aux achats de bâtiments, y compris le défrichement. Les ressources disponibles sont utilisées en priorité ; chaque unité manquante est remplacée par du prestige. L’interface annonce le coût en prestige et sa valeur en points de fin de partie avant confirmation. Annuler ne dépense rien. Un placement interdit ou un solde insuffisant est toujours refusé.

Les anciennes sauvegardes compatibles reçoivent les missions et le prestige de départ une seule fois, sans réinitialiser les soldes lors des rechargements suivants. Leur progression initiale est reconstituée d’après le plateau et les ouvriers ; les anciens terrains transformés ne peuvent pas être reconstitués avec certitude. Une nouvelle partie garantit un suivi complet depuis le départ.

Les sauvegardes antérieures aux difficultés conservent leurs offres visibles et leurs missions gagnées ; les nouvelles variantes sont ajoutées à la pioche une seule fois. Une nouvelle partie garantit un départ avec trois offres à une étoile. Les récompenses restent à 1 prestige par défaut à chaque difficulté ; `reward.prestige` reste indépendant et configurable.

Les valeurs initiales des deux unités particulières sont :

| Identifiant | Coût (`cost`) | Population | Déplacements | Points avant coefficient |
| --- | --- | --- | --- | --- |
| `worker` | `{"wheat": 1}` | 1 | 0 | 2 (× `scoring.unit`) |
| `king` | `{}` | 0 | 2 | 0 |

L’ouvrier est recruté par le bouton dédié, selon `workerRecruitmentLimitPerTurn`. Sa `population` doit être strictement positive et ses `moves` doivent rester à 0 : il s’affecte directement aux producteurs. Le roi est fourni au départ, sans achat ; son `cost` est vide. Ses `moves` déterminent ses déplacements initiaux et leur renouvellement à chaque tour. Sa `population` compte dans les logements si elle est augmentée. Ni `king` ni `worker` ne peuvent figurer dans `trains`. Les sauvegardes conservent les effectifs et ressources existants ; les prochains recrutements utilisent la nouvelle définition.

`recruitment` vaut `initial` pour `king`, `direct` pour `worker` et `building` pour les autres unités. Un coût non vide pour une unité initiale est refusé, car elle n’est pas achetée.

Dans `missions.json`, `marketSize` détermine le nombre d’offres ; `initialDifficulty` leur niveau initial ; `maxDifficulty` le dernier niveau ; `requiredContribution` la progression minimale après apparition. Chaque famille doit contenir un objectif par niveau de 1 à `maxDifficulty`.

Le terrain `field` (Champs) est créé par les fermes : leurs cases annexes portent `transformTo: "field"` dans la légende. Les conditions de voisinage des moulins exigent `terrain: "field"` en plus du rôle et du propriétaire. Les anciennes cases de rôle `field` sont converties au chargement.
