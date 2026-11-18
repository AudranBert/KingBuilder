# KingBuilder

Prototype de jeu de plateau pour deux joueurs sur le même écran, en français. Aucune installation de dépendances nécessaire : Node.js 20 ou supérieur suffit.

## Jouer

```sh
npm start
```

Ouvrir http://127.0.0.1:4173. Le menu principal propose Solo et Local multiplayer (deux joueurs à tour de rôle sur le même écran). Versus bot et Online multiplayer sont verrouillés et non fonctionnels pour le moment. En solo, un seul royaume joue 20 tours avant de consulter son score final.

`npm start` génère le site avant de lancer le serveur. Après modification des sources, relancer le serveur pour actualiser le site.

## Organisation du projet

```text
src/                 Code JavaScript du jeu et de l’interface
  ui/                Rendu du plateau, vues et interactions
  styles/            Feuilles de style
assets/
  textures/          Illustrations SVG des terrains
config/              Configuration JSON, guide et catalogue des tuiles
public/              Page HTML et fichiers statiques copiés à la racine du site
tests/               Tests exécutés directement sur les sources
scripts/             Génération du site et validation de la configuration
output/              Illustrations de référence du projet
dist/                Site généré, ignoré par Git
```

Modifier les fichiers sources dans ces dossiers, puis générer le site avec :

```sh
npm run build
```

Le build utilise uniquement Node.js, sans dépendance supplémentaire. Il recrée `dist/` en copiant `public/` à sa racine, puis `src/`, `assets/` et `config/` en conservant les chemins relatifs. Publier le contenu de `dist/` ; la configuration d’hébergement pointe déjà vers ce dossier. Ne pas modifier ses fichiers directement : la génération suivante les remplace.

La partie est sauvegardée automatiquement dans le navigateur. « Revenir au menu principal » permet de revenir au choix des modes et « Reprendre la partie » de continuer la sauvegarde, y compris après rechargement. Démarrer une nouvelle partie depuis le menu demande confirmation avant de remplacer une sauvegarde existante. Les anciennes sauvegardes à deux joueurs restent compatibles. Les règles sont accessibles depuis le bandeau supérieur.

## Règles provisoires

- Plateau 12 × 12 ; rois au milieu des bords opposés ; 20 tours pour chacun.
- 2 déplacements orthogonaux et une action facultative (explorer ou construire) par unité et par tour, les déplacements précédant l’action. Le recrutement d’un ouvrier est indépendant.
- Marché partagé de 3 tuiles gratuites, avec rotation et choix d’une case de contact adjacente, de tout terrain. Pas de chevauchement ni de sortie du plateau.
- Treize formes de terrain : ligne de 2, ligne de 3, L de 3, Z de 4, carré de 4, croix de 5 (`.x. / xxx / .x.`), U de 5 (`x.x / xxx`), L de 4 (`x.. / xxx`), T de 4 (`.x.. / xxx`), ligne de 4, escalier de 5 (`xx. / .xx / ..x`) motif de 5 (`.xx. / .xxx`) et T de 5 (`xxx / .x. / .x.`). Les formes actuelles font au plus cinq cases, sans limite mécanique empêchant de configurer de plus grandes formes. Le T est équivalent à `xxx / .x.` par rotation et n’est donc pas ajouté en double. L’anneau de 8 et le rectangle de 6 sont exclus. Les points sont des vides : ils ne révèlent ni ne réservent de case. Chaque forme peut pivoter ; les terrains sont fixés dans un catalogue de 60 tuiles. Les nouvelles formes sont présentes dans la pioche des nouvelles parties.
- Marché partagé de 3 tuiles bâtiments, remplacées à l’achat. Construction sous le roi, avec exception adjacente pour le pont et la carrière en montagne. Motifs pivotables, tous les terrains déjà révélés, aucune superposition entre bâtiments.
- Montagne et rivière infranchissables ; un pont permet de traverser sa case rivière. Une maison se construit sur plaine ou forêt. Les constructions peuvent avoir leur entrée sur la case de l’unité ou sur une case voisine par un bord.
- Un ouvrier coûte 1 blé, au maximum un recrutement par tour. Chaque maison accueille deux ouvriers. Les ouvriers s’affectent et se réaffectent directement à vos bâtiments de production, sans trajet ni coût. Un ouvrier au maximum par bâtiment de production ; les affectations finales déterminent la production.
- Production en fin du tour de son propriétaire : ferme/port = blé, scierie = bois, carrière = pierre, mine = fer. Un bâtiment sans ouvrier ne produit pas.
- Départ : un château non constructible (2 places de population), un ouvrier disponible, 2 bois, 1 blé, 2 pierres, 0 fer par joueur. Les cases de départ ne comptent pas comme révélées.
- Score : 1 par case révélée + 1 par bâtiment + 2 par ouvrier + stock total de ressources × 0,34 (arrondi inférieur) + 3 par prestige restant. Égalité : victoire partagée.
- Les pioches sont mélangées au départ ; elles contiennent 60 tuiles de terrain et 60 bâtiments/actions, assez pour les 40 tours individuels.

## Configurer le jeu

- `config/terrain-tiles.json` : formes dessinées avec `x` et `.`, et catalogue de 60 tuiles aux terrains prédéfinis.
- `config/buildings.json` : coûts, motifs, terrains, productions, logements, bonus et conditions de voisinage.
- `config/resources.json` : noms, symboles, quantités initiales et points par ressource.
- `config/units.json` : définitions du roi, de l’ouvrier et des unités recrutables : noms, symboles, coûts, déplacements, population et points. Le coût de recrutement et la population de l’ouvrier se règlent dans son entrée `worker`.
- `config/terrains.json` : types de terrain, noms, symboles, couleurs et traversabilité.
- `config/game-rules.json` : plateau, tours, effectif initial d’ouvriers, quota de recrutement, tailles des marchés, déblocage des tiers, distances de placement, royaumes, barème des scores et prestige.
- `config/missions.json` : missions communes, seuils et récompenses en prestige.

Le guide [config/README.md](config/README.md) explique les champs avec des exemples prêts à adapter. Ajouter un terrain, une ressource ou un bâtiment utilisant un effet existant ne demande aucune modification du moteur.

```sh
npm run check:config
```

Recharger la page après modification et commencer une nouvelle partie pour reconstruire les pioches. Les 13 formes actuelles ont au plus cinq cases ; aucune limite mécanique de taille n’est imposée.

## Vérifier

```sh
npm test
```

Les tests couvrent déplacements, placements, achats, production, ouvriers, maisons et fin de partie. `dist/` est généré par `npm run build` et contient le site statique complet ; `server.mjs` fournit uniquement un serveur de développement local.

L’interface sépare déplacement et inspection. Sélectionner une carte terrain ou bâtiment affiche les placements valides en vert dans son orientation actuelle. Cliquer une case place la carte ; le glisser-déposer reste disponible. Le survol ou le focus d’une case explique les refus. R pivote la carte sélectionnée ; Échap annule. Les unités se déplacent par glisser-déposer ou par sélection puis clic sur une case dorée. La touche R pivote la tuile pendant le glissement. Les cases du plateau se parcourent aussi avec les flèches du clavier et Entrée. Les sauvegardes incompatibles, notamment celles de l’ancien plateau 25 × 25, sont copiées avant de démarrer une nouvelle partie. Une erreur de sauvegarde est signalée à l’écran.

## Tuiles bâtiments — version 2

Les coordonnées sont relatives à l’entrée du bâtiment et pivotent par quarts de tour.

| Tuile | Motif | Coût | Effet |
| --- | --- | --- | --- |
| Ferme | Plaine centrale + 4 plaines voisines par un bord | 1 bois | Les 4 plaines deviennent des champs ; 1 blé avec ouvrier |
| Mine | Plaine d’entrée (0,0), montagnes (1,0), (2,0), (3,0) | 2 bois + 1 pierre | 1 fer avec ouvrier |
| Port | Plaine d’entrée (0,0), eaux (1,-1), (1,0), (1,1) | 2 bois + 1 pierre | 1 blé avec ouvrier ; l’eau reste infranchissable |
| Pont | 1 rivière adjacente au roi | 2 bois | Case traversable |
| Moulin | Plaine touchant votre champ par un bord et votre ferme par un bord ou un coin | 2 bois + 1 pierre | Double le blé de vos fermes voisines ; sans ouvrier au moulin, sans cumul |
| Défrichement | 1 forêt libre | Gratuit | Donne immédiatement 2 bois et devient une plaine libre ; consomme l’action, aucun bâtiment ni point de bâtiment |

La maison reste une tuile d’une case. La scierie et la carrière disposent également de variantes de plusieurs cases, avec les mêmes coûts et effets. Les cases auxiliaires des motifs sont réservées et consultables : cliquer un champ permet de consulter et gérer l’affectation de sa ferme. Un bâtiment de plusieurs cases ne compte toujours que pour un bâtiment au score. Les champs sont une surcouche de plaine, marchable, sans production autonome. Seul le pont rend l’eau traversable.

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
- Définitions et coûts des unités dans `config/units.json`. Chaque bâtiment formateur référence ses choix dans `trains` et son quota dans `trainingLimit`.

Explorer révèle une tuile voisine sans déplacer l’unité. Les terrains sont prédéfinis par tuile ; certaines tuiles peuvent être entièrement infranchissables.

Chaque unité dispose par tour de 2 déplacements et d’une action indépendante (explorer OU construire). Explorer ou construire termine l’activation et les déplacements restants : il faut se déplacer avant son action. Recruter un ouvrier ne termine plus les actions de l’unité sélectionnée. Une unité devient grisée dès que son action est effectuée.

Le catalogue illustré par motifs se trouve dans `config/tile-catalogue.md`. Les parties existantes conservent leur pioche ; démarrer une nouvelle partie pour recevoir les 60 tuiles prédéfinies.


## Prestige et missions

Le premier joueur commence à 0 prestige, le second à 1. Chaque prestige restant vaut 3 points. Trois missions communes s’affichent au-dessus du plateau : la première personne à remplir un objectif visible reçoit sa récompense (1 prestige par défaut) et une nouvelle mission prend sa place. Les 48 variantes (16 objectifs × 3 difficultés) et leurs récompenses se configurent dans `config/missions.json`.

Le bouton ↻ d’un marché remplace ses trois offres pour 1 prestige, une fois par joueur et par tour, sans consommer l’action d’une unité. Le prestige sert aussi de joker : 1 prestige par ressource manquante pour un bâtiment, avec confirmation explicite du coût avant toute dépense.

Les trois missions commencent à ★. Chaque objectif remporté est remplacé par un objectif aléatoire du niveau supérieur (★ → ★★ → ★★★), puis les missions ★★★ sont remplacées par d’autres ★★★ disponibles. Les seuils et récompenses de chaque niveau sont modifiables dans `missions.json`.

La case d’entrée de tout bâtiment peut être placée sur la case de l’unité sélectionnée ou sur une case adjacente par un bord, jamais en diagonale. Les contraintes de terrain et de motif restent applicables.

Variantes du marché : le port et la mine existent aussi avec un carré de 2 × 2 d’eau ou de montagnes adjacent à leur entrée sur plaine. Leurs coûts et productions sont identiques aux versions en ligne. La carrière de plaine et la carrière de montagne occupent chacune uniquement leur terrain indiqué, jamais une forêt. La pioche contient 66 cartes : 12 maisons, 6 fermes, 6 scieries, 6 ponts, 5 moulins, 5 casernes, 8 défrichements et 6 tuiles par famille de carrière, mine et port (2 de chacune des 3 variantes). Chaque famille est limitée à 12 tuiles, variantes comprises. Recharger et commencer une nouvelle partie pour obtenir les nouvelles variantes dans la pioche.

Le château remplace la maison initiale. Il accueille 2 unités de population et ne figure jamais dans les 66 tuiles bâtiments/actions. Les maisons restent constructibles.

La ferme existe en croix, Z et T ; la scierie sur une case, en croix et en L (2 tuiles par variante). Les variantes gardent les mêmes coûts et productions. La ferme en Z bénéficie du moulin comme la ferme en croix. Les familles restent à 6 tuiles et la pioche à 60.

Chaque famille concernée compte trois variantes au total : ferme (croix, Z, T), scierie (simple, croix, L), carrière (plaine, montagne, flanc de montagne), mine (ligne, carré, coude), port (colonne, carré, coude), moulin (simple, cour en ligne, cour en L). Les cinq premières familles ont 2 exemplaires par variante. Les moulins gardent 5 tuiles : 1 simple, 2 en ligne et 2 en L, avec les mêmes contraintes de voisinage et le même bonus. Pont, maison, caserne, défrichement et château ne reçoivent pas de variantes.

Tiers des bâtiments : 0 étoile pour le pont et le défrichement ; 1 étoile pour les maisons et les producteurs de ressources (toutes variantes) ; 2 étoiles pour les moulins et casernes. Les trois offres initiales sont tirées uniquement parmi les tiers 0 et 1, sans retirer les tiers 2 de la pioche. Le premier remplacement du marché reste limité aux tiers 0 et 1 ; les cartes de tier 2 sont conservées dans la pioche et deviennent éligibles dès le deuxième remplacement. Ce compteur est partagé entre les joueurs : un achat ou une relance complète du marché bâtiments compte comme un remplacement. Les relances de terrains ne comptent pas. Les anciennes sauvegardes sans compteur conservent leur marché débloqué. Le château reste hors pioche. Les étoiles sont affichées sur les cartes du marché.

Interface : les cartes bâtiments montrent leur effet et leur coût. Le bouton « Voir les détails » ouvre une fiche avec le motif agrandi, les terrains, les étoiles et les règles de placement ; glisser la carte reste le geste de construction. En mode Inspecter, une case occupée par votre unité permet aussi de consulter son bâtiment. Sur petit écran, le plateau précède les marchés et les missions occupent la pleine largeur.

## Récolte prévisionnelle et score des ressources

Le panneau sous le plateau annonce les gains exacts de fin de tour, bonus des moulins compris. Les producteurs sans ouvrier portent un « ! » et sont listés avec un bouton d’affectation si un ouvrier est libre. Après construction, le bâtiment reste sélectionné pour permettre cette affectation.

Les stocks rapportent le total des ressources × `scoring.resource`, avec arrondi inférieur. Le coefficient vaut 0.34 : 3 ressources donnent 1 point, 6 en donnent 2, 100 en donnent 34. Les unités, ouvriers et roi compris, utilisent leurs propres `points` dans `units.json`, multipliés par `scoring.unit`. Les anciennes sauvegardes reçoivent les seuils de contribution des missions visibles lors de leur premier chargement avec cette règle ; les récompenses déjà gagnées sont conservées.
