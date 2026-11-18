# KingBuilder

Prototype de jeu de plateau pour deux joueurs sur le même écran, en français. Aucune installation de dépendances nécessaire : Node.js 20 ou supérieur suffit.

## Jouer

```sh
npm start
```

Ouvrir http://127.0.0.1:4173. Le menu principal propose Solo et Local multiplayer (deux joueurs à tour de rôle sur le même écran). Versus bot et Online multiplayer sont verrouillés et non fonctionnels pour le moment. En solo, un seul royaume joue 20 tours avant de consulter son score final.

La partie est sauvegardée automatiquement dans le navigateur. « Revenir au menu principal » permet de revenir au choix des modes et « Reprendre la partie » de continuer la sauvegarde, y compris après rechargement. Démarrer une nouvelle partie depuis le menu demande confirmation avant de remplacer une sauvegarde existante. Les anciennes sauvegardes à deux joueurs restent compatibles. Les règles sont accessibles depuis le bandeau supérieur.

## Règles provisoires

- Plateau 12 × 12 ; rois au milieu des bords opposés ; 20 tours pour chacun.
- 2 déplacements orthogonaux et une action facultative (explorer ou construire) par unité et par tour, les déplacements précédant l’action. Le recrutement d’un ouvrier est indépendant.
- Marché partagé de 3 tuiles gratuites, avec rotation et choix d’une case de contact adjacente, de tout terrain. Pas de chevauchement ni de sortie du plateau.
- Treize formes de terrain : ligne de 2, ligne de 3, L de 3, Z de 4, carré de 4, croix de 5 (`.x. / xxx / .x.`), U de 5 (`x.x / xxx`), L de 4 (`x.. / xxx`), T de 4 (`.x.. / xxx`), ligne de 4, escalier de 5 (`xx. / .xx / ..x`) motif de 5 (`.xx. / .xxx`) et T de 5 (`xxx / .x. / .x.`). Les formes actuelles font au plus cinq cases, sans limite mécanique empêchant de configurer de plus grandes formes. Le T est équivalent à `xxx / .x.` par rotation et n’est donc pas ajouté en double. L’anneau de 8 et le rectangle de 6 sont exclus. Les points sont des vides : ils ne révèlent ni ne réservent de case. Chaque forme peut pivoter ; les terrains sont fixés dans un catalogue de 60 tuiles. Les nouvelles formes sont présentes dans la pioche des nouvelles parties.
- Marché partagé de 3 tuiles bâtiments, remplacées à l’achat. Construction sous le roi, avec exception adjacente pour le pont et la carrière en montagne. Motifs pivotables, tous les terrains déjà révélés, aucune superposition entre bâtiments.
- Montagne et rivière infranchissables ; un pont permet de traverser sa case rivière. Une maison se construit sur plaine ou forêt (la montagne n'est de fait pas accessible au roi).
- Un ouvrier coûte 1 blé, au maximum un recrutement par tour. Chaque maison accueille deux ouvriers. Les ouvriers s’affectent et se réaffectent directement à vos bâtiments de production, sans trajet ni coût. Un ouvrier au maximum par bâtiment de production ; les affectations finales déterminent la production.
- Production en fin du tour de son propriétaire : ferme/port = blé, scierie = bois, carrière = pierre, mine = fer. Un bâtiment sans ouvrier ne produit pas.
- Départ : une maison, un ouvrier disponible, 2 bois, 1 blé, 2 pierres, 0 fer par joueur. Les cases de départ ne comptent pas comme révélées.
- Score : 1 par case révélée + 1 par bâtiment + 2 par ouvrier + 1 par ressource + 3 par prestige restant. Égalité : victoire partagée.
- Les pioches sont mélangées au départ ; elles contiennent 60 tuiles et 90 bâtiments/actions, assez pour les 40 tours individuels.

## Configurer le jeu

- `dist/config/terrain-tiles.json` : formes dessinées avec `x` et `.`, et catalogue de 60 tuiles aux terrains prédéfinis.
- `dist/config/buildings.json` : coûts, motifs, terrains, productions, logements, bonus et conditions de voisinage.
- `dist/config/resources.json` : noms, symboles, quantités initiales, points par ressource et coût de recrutement.
- `dist/config/units.json` : liste des unités recrutables, noms, symboles, coûts, déplacements, population et points.
- `dist/config/terrains.json` : types de terrain, noms, symboles, couleurs et traversabilité.
- `dist/config/game-rules.json` : taille du plateau, limite de tours, barème des scores et coûts du prestige.
- `dist/config/missions.json` : missions communes, seuils et récompenses en prestige.

Le guide [dist/config/README.md](dist/config/README.md) explique les champs avec des exemples prêts à adapter. Ajouter un terrain, une ressource ou un bâtiment utilisant un effet existant ne demande aucune modification du moteur.

```sh
npm run check:config
```

Recharger la page après modification et commencer une nouvelle partie pour reconstruire les pioches. Les 13 formes actuelles ont au plus cinq cases ; aucune limite mécanique de taille n’est imposée.

## Vérifier

```sh
npm test
```

Les tests couvrent déplacements, placements, achats, production, ouvriers, maisons et fin de partie. `dist/` contient le site statique complet ; `server.mjs` fournit uniquement un serveur de développement local.

L’interface sépare déplacement et inspection. Les terrains et bâtiments se placent uniquement par glisser-déposer, avec un aperçu de validité. Les unités se déplacent par glisser-déposer ou par sélection puis clic sur une case dorée. La touche R pivote la tuile pendant le glissement. Les cases du plateau se parcourent aussi avec les flèches du clavier et Entrée. Les sauvegardes incompatibles, notamment celles de l’ancien plateau 25 × 25, sont copiées avant de démarrer une nouvelle partie. Une erreur de sauvegarde est signalée à l’écran.

## Tuiles bâtiments — version 2

Les coordonnées sont relatives à l’entrée sous le roi et pivotent par quarts de tour.

| Tuile | Motif | Coût | Effet |
| --- | --- | --- | --- |
| Ferme | Plaine centrale + 4 plaines voisines par un bord | 1 bois | Les 4 plaines deviennent des champs ; 1 blé avec ouvrier |
| Mine | Plaine d’entrée (0,0), montagnes (1,0), (2,0), (3,0) | 2 bois + 1 pierre | 1 fer avec ouvrier |
| Port | Plaine d’entrée (0,0), eaux (1,-1), (1,0), (1,1) | 2 bois + 1 pierre | 1 blé avec ouvrier ; l’eau reste infranchissable |
| Pont | 1 rivière adjacente au roi | 2 bois | Case traversable |
| Moulin | Plaine touchant votre champ par un bord et votre ferme par un bord ou un coin | 2 bois + 1 pierre | Double le blé de vos fermes voisines ; sans ouvrier au moulin, sans cumul |
| Défrichement | 1 forêt libre sous le roi | 1 blé | Devient une plaine libre ; consomme l’action, aucun bâtiment ni point de bâtiment |

Maison, scierie et carrière restent des tuiles d’une seule case avec leurs coûts et effets précédents. Les cases auxiliaires des motifs sont réservées et consultables : cliquer un champ permet de consulter et gérer l’affectation de sa ferme. Un bâtiment de plusieurs cases ne compte toujours que pour un bâtiment au score. Les champs sont une surcouche de plaine, marchable, sans production autonome. Seul le pont rend l’eau traversable.

Le moulin est passif, ne demande pas d’ouvrier et double la production uniquement si un ouvrier est affecté à la ferme. Les fermes se trouvant à distance de voisinage 1, diagonales incluses, du moulin bénéficient du bonus ; plusieurs moulins ne multiplient pas ce bonus. Les champs et la ferme requis au placement doivent appartenir au même joueur que le moulin.

Les sauvegardes version 1 sont migrées sans effacer la partie : les bâtiments existants conservent leur ancien emplacement ; les nouveaux placements suivent les motifs. Les nouvelles cartes sont ajoutées en fin de pioche des anciennes parties. Commencer une nouvelle partie mélange les dix types dès le départ.

## Affectation directe des ouvriers — version 4

- Le roi et les cavaliers se déplacent manuellement. Les ouvriers n’ont ni position indépendante sur le terrain, ni points de déplacement.
- Dans « Vos ouvriers », choisir un bâtiment dans la liste d’un ouvrier l’y affecte instantanément, sans condition de distance, terrain, chemin ou position du roi. Choisir un autre bâtiment le transfère et désactive la production de l’ancien ; « Non affecté » le libère.
- Cliquer un bâtiment sur le plateau permet aussi d’y affecter un ouvrier libre ou de libérer son ouvrier. Chaque bâtiment de production accueille au maximum un ouvrier. Seuls vos bâtiments de production sont des destinations possibles.
- Affectation et réaffectation gratuites, illimitées, à tout moment de son tour, y compris après construction, exploration ou recrutement. La récolte dépend uniquement des affectations finales à la fin du tour. Le moulin reste passif.
- Un ouvrier recruté coûte 1 blé et une place dans la capacité totale des maisons. Il est immédiatement disponible pour une affectation. Les ouvriers ne bloquent pas le roi.
- Ressources de départ : 2 pierres, 2 bois, 1 blé et aucun fer. Les parties en cours conservent leurs ressources.
- Migration des sauvegardes : un ouvrier de version 3 présent sur son bâtiment de production y reste affecté ; les ouvriers sur les autres cases redeviennent disponibles. Les affectations des versions 1 et 2 sont conservées. La population, les ressources et la progression sont préservées.

## Caserne et cavalier

- Caserne : motif d’une case de plaine, coût provisoire 2 bois + 2 pierres. Recrute au choix une unité par caserne et par tour, sans ouvrier affecté et sans consommer l’action d’une unité.
- Cavalier : coût 1 fer + 1 blé, 1 place dans la population totale des maisons, comme un ouvrier. Le roi ne compte pas dans cette capacité.
- Apparition sur la caserne ; activation au prochain tour du propriétaire. Les unités alliées peuvent partager une case. Les pions adverses bloquent les déplacements ; aucun combat n’est ajouté.
- Chaque cavalier a ses propres 2 déplacements et sa propre action d’exploration ou de construction, avec les mêmes contraintes que le roi. Sélectionner ou glisser le pion directement sur le plateau. Les ressources, les marchés et le score d’exploration/construction sont communs au joueur.
- Le recrutement d’un ouvrier reste limité à un par joueur et par tour. Il ne consomme ni les déplacements ni l’action des unités.
- Les cavaliers ne rapportent pour l’instant aucun point direct ; les points de leurs explorations et constructions sont comptés normalement.
- Définitions et coûts des unités dans `dist/config/units.json`. Chaque bâtiment formateur référence ses choix dans `trains` et son quota dans `trainingLimit`.

Explorer révèle une tuile voisine sans déplacer l’unité. Les terrains sont prédéfinis par tuile ; certaines tuiles peuvent être entièrement infranchissables.

Chaque unité dispose par tour de 2 déplacements et d’une action indépendante (explorer OU construire). Explorer ou construire termine l’activation et les déplacements restants : il faut se déplacer avant son action. Recruter un ouvrier ne termine plus les actions de l’unité sélectionnée. Une unité devient grisée dès que son action est effectuée.

Le catalogue illustré par motifs se trouve dans `dist/config/tile-catalogue.md`. Les parties existantes conservent leur pioche ; démarrer une nouvelle partie pour recevoir les 60 tuiles prédéfinies.


## Prestige et missions

Le premier joueur commence à 0 prestige, le second à 1. Chaque prestige restant vaut 3 points. Trois missions communes s’affichent au-dessus du plateau : la première personne à remplir un objectif visible reçoit sa récompense (1 prestige par défaut) et une nouvelle mission prend sa place. Les 48 variantes (16 objectifs × 3 difficultés) et leurs récompenses se configurent dans `dist/config/missions.json`.

Le bouton ↻ d’un marché remplace ses trois offres pour 1 prestige, une fois par joueur et par tour, sans consommer l’action d’une unité. Le prestige sert aussi de joker : 1 prestige par ressource manquante pour un bâtiment, avec confirmation explicite du coût avant toute dépense.

Les trois missions commencent à ★. Chaque objectif remporté est remplacé par un objectif aléatoire du niveau supérieur (★ → ★★ → ★★★), puis les missions ★★★ sont remplacées par d’autres ★★★ disponibles. Les seuils et récompenses de chaque niveau sont modifiables dans `missions.json`.
