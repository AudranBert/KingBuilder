## 1. Le but

2 manières de gagner :

- Prenez le donjon adverse avec au moins un soldat survivant pour gagner.
- Sinon, après {{rounds}} tours chacun, le meilleur score gagne.

## 2. Préparer le plateau

- Plateau : {{size}} × {{size}} cases.
- Tuile de départ avec donjon au centre des côtés.
- Chacun pose {{openingCount}} tuile(s) sur des cases libres, à tour de rôle.
- 2 ouvriers chacun.

## 3. Jouer son tour

À chaque tour, le joueur peut utiliser ses ouvriers et ses soldats.
Les unités peuvent se déplacer de {{workerMoves}} cases à chaque tour.
Chaque ouvrier peut effectuer une seule action, avant ou après s’être déplacé, parmi :

- Explorer
- Construire
- Produire

## 4. Explorer

Explorer : posez une tuile terrain à côté d’un ouvrier.
Vous pouvez aussi révéler une seule case du terrain que vous voulez pour {{singleTerrainCost}} or.
Renouveler les tuiles terrain proposées coûte {{rerollCost}} or, une fois par tour.

## 5. Construire

Construire : payez le coût et posez une tuile bâtiment sur la case de l’ouvrier ou à côté.
Vous devez respecter le terrain du motif. Le bâtiment doit être posé sur une case vide.

Le marché commence avec 3 cartes bâtiment :

- Après une construction, les cartes au-dessus de la carte achetée descendent pour combler sa place. Une nouvelle carte arrive en haut.
- Après un tour complet de tous les joueurs, ajoutez une carte en haut et décalez les autres vers le bas.
- Le marché contient au maximum 5 cartes. Lorsqu'une 6e arrive, défaussez celle du bas.

Bâtiments spécifiques :

- Le pont et le tunnel permettent de traverser l’eau et la montagne, respectivement.
- Le défrichement permet de transformer une forêt en plaine et de gagner du bois.
- La maison donne un nouvel ouvrier, actif à partir du prochain tour.
- La caserne permet de produire une unité par tour en échange de blé.

## 6. Produire et progresser

Produire permet de gagner des ressources.
Vous pouvez gagner des ressources :

- Plaine libre : 1 blé.
- Forêt libre : 1 bois.
- Votre bâtiment : sa production indiquée. Chaque bâtiment produit une seule fois par tour. Seuls les bâtiments producteurs de ressources ont besoin d’un ouvrier.

Renouveler les cartes proposées coûte {{rerollCost}} or, une fois par tour.


## 7. Combattre et conquérir

Chaque soldat peut se déplacer et attaquer. Un soldat coûte 2 blés. Vous pouvez :

- Grouper vos soldats en empilant des pions.
- Diviser votre armée en dépilant des pions.

Chaque soldat représente 1 point de puissance. Une armée a un point de puissance bonus quand elle se défend. Le plus fort garde autant de soldats que l’écart des forces.

- Si, lors d’un combat, l’armée attaquante survit, elle capture la case attaquée.
- Un ouvrier capturé revient au donjon, actif au prochain tour.

La tour et le donjon ont une puissance de 2. Il faut donc une armée de 3 soldats pour les vaincre.

Les ouvriers peuvent capturer un drapeau ou conserver un bâtiment adverse sans défense.

## 8. Extension optionnelle : Missions

Les missions sont optionnelles. Ce sont 3 objectifs affichés en haut du plateau qui donnent des récompenses au premier joueur à remplir la condition.

Une fois accomplies, elles sont remplacées par une mission du niveau supérieur.

Si une nouvelle mission apparaît et que vous remplissez déjà la condition, il faut tout de même contribuer à la mission pendant ce tour pour la valider. Exemple : pour une mission « Produire 10 bois », si vous en avez 11, il faut en produire un 12e pour la valider.
