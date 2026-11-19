# KingBuilder

Jeu de placement de tuiles en duel, en français, jouable à deux sur le même écran. Le terrain est commun : explorez, développez votre économie et disputez les positions adverses.

## Jouer

Node.js 20 ou supérieur suffit, sans installation de dépendances.

```sh
npm start
```

Ouvrir http://127.0.0.1:4173. Solo et Local multiplayer sont disponibles ; les modes bot et en ligne restent verrouillés. Avant chaque nouvelle partie, un menu permet de régler la durée, la préparation, les ressources initiales et la taille de la grille.

Une partie reste active tant que la page reste ouverte. Choisir un mode depuis le menu lance une nouvelle partie.

## Règles du duel

### Victoire

- Occuper le donjon adverse avec au moins un soldat survivant donne une victoire immédiate.
- Sinon, après le nombre de tours choisi (25 par défaut, de 20 à 40) pour chaque joueur, additionner les points des bâtiments, des drapeaux contrôlés et de l’or restant. Une égalité donne une victoire partagée.
- Chaque bâtiment ordinaire rapporte 1 point ; un monument en rapporte 6 ; chaque drapeau vaut 4 points. Le donjon et le défrichement ne rapportent rien.
- Chaque paire de pièces d’or restant en stock rapporte 1 point. Les terrains révélés, les ouvriers, les soldats, la nourriture et les matériaux ne rapportent aucun point.

### Plateau et placement

- Plateau de 11 × 11 par défaut, réglable de 7 × 7 à 15 × 15. Les cinq objectifs s’adaptent à la taille choisie.
- Les rois commencent au milieu des bords opposés, chacun sur son donjon. Les trois cases directement voisines par un bord sont des plaines déjà révélées et sans propriétaire ; les diagonales restent inexplorées.
- Avant le tour 1, chaque joueur place de 0 à 4 grandes tuiles terrain (2 par défaut), en commençant par J2 en local. Les offres sont communes et ne se renouvellent pas pendant cette préparation. Ces poses ne consomment ni tour ni action et ne remplissent pas les missions.
- Cinq drapeaux neutres sont préplacés et déjà révélés : un au centre, quatre autour du centre.
- Les joueurs révèlent des tuiles de terrain depuis un marché commun de quatre offres. Les terrains restent utilisables par les deux joueurs.
- Les empreintes des bâtiments et leurs terrains requis forment le puzzle. Tous les éléments du motif doivent être révélés et respecter les terrains. Les annexes compatibles peuvent se chevaucher ; seules les cases occupées par un bâtiment lui-même bloquent une autre construction. L’entrée doit être à une case maximum du bâtisseur, sans diagonale.
- Le marché initial propose quatre familles différentes de bâtiments à une étoile. La maison appartient au niveau deux étoiles et arrive après le déblocage des bâtiments avancés.
- Niveaux : 0 étoile pour défrichement, pont et tunnel ; 1 étoile pour les fermes, scieries, carrières, mines et pêcheurs ; 2 étoiles pour les ports et tous les autres bâtiments.
- Les montagnes et les rivières sont infranchissables, sauf sur un tunnel, un pont ou un avant-poste. Les joueurs doivent préserver leurs accès.
- Seuls les bâtiments, leurs annexes et les drapeaux contrôlés portent des contours de propriété. Les terrains explorés n’appartiennent à personne.

### Ressources et commerce

| Ressource | Production | Utilisation |
| --- | --- | --- |
| Nourriture | Fermes et pêcheurs | Maisons, casernes, recrutement |
| Matériaux | Scieries et carrières | Construction |
| Or | Mines, ports et missions | Banque, bâtiments avancés et relances |

Un producteur nécessite un ouvrier ; la récolte a lieu en fin de tour du propriétaire. Un moulin se construit sur une plaine ou un champ, à côté d’un champ allié ; il double la nourriture de cette ferme, sans cumul.

À la construction ou au recrutement, les ressources manquantes peuvent être achetées à la banque. Chaque ressource coûte **2 ors + 1 par bâtiment adverse capable de la produire**, même sans ouvrier. Le paiement utilise d’abord les stocks disponibles. L’or lui-même ne s’achète pas. L’achat ne permet pas de stocker des ressources supplémentaires.

La construction affiche un complément d’achat à confirmer. Le bouton de recrutement montre son coût réel, achat à la banque compris.

Pour 1 or, le roi ou l’émissaire peut révéler une case voisine du terrain de son choix (plaine, forêt, montagne ou rivière). Cet achat consomme son action d’exploration et ne retire aucune tuile de la pioche.

L’or remplace le prestige : les missions donnent de l’or ; renouveler les quatre offres d’un marché coûte 1 or, une fois par joueur et par tour. Les missions continuent à exiger une contribution après leur apparition, et montent de difficulté après leur attribution.

Départ par défaut : un ouvrier disponible, 3 matériaux, 2 nourritures et 1 or. Chaque ressource peut être réglée de 0 à 10 avant la partie. Le second joueur reçoit toujours 1 or supplémentaire.

### Ouvriers et maisons

Une maison coûte 2 nourritures et 2 matériaux. Elle ajoute immédiatement un ouvrier à la réserve, utilisable pour la récolte du même tour. Les ouvriers s’affectent et se réaffectent gratuitement à distance, avec un seul ouvrier par producteur. Il n’existe plus de capacité de population ni de recrutement séparé d’ouvriers.

### Unités de développement

Le roi dispose de 3 déplacements orthogonaux puis d’une action : explorer ou construire. Une action met fin à son activation.

Une Chancellerie coûte 4 matériaux et 3 ors et fournit un émissaire du roi. Limite : une Chancellerie et un émissaire par joueur. Il dispose lui aussi de 3 déplacements puis d’une action de développement indépendante. Il ne combat pas et ne capture pas les drapeaux par déplacement.

L’émissaire apparaît sur sa Chancellerie, grisé jusqu’au prochain tour.

### Casernes et armées

- Une caserne coûte 1 nourriture et 2 matériaux et fournit un premier soldat gratuit.
- Chaque caserne permet ensuite de recruter un soldat par tour pour 2 nourritures, éventuellement achetées à la banque.
- Les nouvelles recrues apparaissent sur la case de leur caserne et sont grisées jusqu’au prochain tour.
- Les soldats sur une même case forment une pile. Choisir un effectif permet de laisser les autres sur place ; déplacer une pile sur une autre permet de les réunir.
- Chaque pion conserve son budget et son état d’activation. Les recrues ou soldats épuisés ne repartent pas avec une pile disponible. Une pile utilise le budget minimal des soldats sélectionnés.
- Une armée dispose de 3 déplacements puis d’une action de combat. Elle ne construit pas et n’explore pas.
- Occuper une cible sans défense consomme également l’action. Impossible d’enchaîner plusieurs captures pendant la même activation.

### Combat

**Attaque = effectif attaquant. Défense = effectif défenseur + 1. Le vainqueur conserve la différence.**

| Attaque | Soldats défenseurs | Résultat |
| --- | --- | --- |
| 7 | 5 | 1 attaquant survit et occupe la case |
| 6 | 5 | Aucun survivant |
| 5 | 5 | 1 défenseur survit |
| 4 | 5 | 2 défenseurs survivent |

Une cible vide n’a pas de bonus défensif. Les combats sont sans hasard. Cliquer une cible rouge affiche la prévision puis le bouton d’attaque ; le glisser-déposer permet aussi d’occuper une cible.

### Drapeaux, avant-postes et donjons

Un soldat qui occupe un drapeau le capture. Sa couleur et ses points persistent après le départ de l’armée, jusqu’à une recapture.

Un avant-poste coûte 2 matériaux et peut être construit sur **toute case révélée sans bâtiment**, quel que soit le terrain, y compris sur une annexe compatible. Sa case devient praticable. Construire sur un drapeau en prend le contrôle ; le drapeau n’est pas un bâtiment et peut coexister avec l’avant-poste.

L’avant-poste et le donjon possèdent une garnison fixe de 1 soldat. Une armée alliée peut les renforcer. Appliquer le bonus défensif +1 une seule fois. La garnison est retirée en dernier et reste présente tant qu’aucun attaquant survivant n’occupe la case, même après une égalité des forces. Ainsi, 2 attaquants ne détruisent pas un avant-poste isolé ; 3 le détruisent avec 1 survivant.

### Destruction et retour des bâtisseurs

Occuper la case réelle d’un bâtiment adverse le détruit. Les terrains annexes ne sont pas des cibles militaires. Toute l’empreinte est libérée ; les terrains restent révélés et les champs reviennent à leur terrain sous-jacent. Les ouvriers affectés retournent à la réserve.

Détruire une maison ne supprime pas son ouvrier. Détruire une caserne ne supprime pas ses soldats déjà recrutés.

Un roi pris retourne au donjon et ne peut pas agir pendant son prochain tour. L’émissaire retourne à sa Chancellerie, ou au donjon si elle a été détruite, avec la même indisponibilité. Occuper le donjon termine immédiatement la partie.

## Commandes

- Cliquer une carte affiche ses placements ; cliquer une case verte la pose. Le glisser-déposer reste disponible.
- Les quatre pictogrammes sous les tuiles de terrain permettent d’acheter une case précise pour 1 or.
- R ou la molette fait pivoter la carte ; Échap annule la sélection.
- Le clic droit efface la sélection. Le bouton ↶ annule une seule dernière action ; il se réactive après une nouvelle action et se vide au changement de tour.
- Sélectionner une unité puis une case dorée la déplace. Sélectionner une cible rouge prépare un combat.
- Pour une armée, le sélecteur **Effectif** choisit combien de pions partent ensemble.
- Glisser un ouvrier de la réserve vers un producteur l’affecte ; le ramener à la réserve le libère.
- Les fiches ⓘ et les règles contiennent les explications ; les cartes privilégient les pictogrammes.

## Développement et configuration

```sh
npm test
npm run check:config
npm run build
```

`src/` contient le moteur et l’interface ; `config/` contient les règles et les catalogues ; `assets/textures/` contient les illustrations. Le build recopie les sources dans `dist/`, seul dossier à publier. Ne pas modifier `dist/` directement.

Le guide [config/README.md](config/README.md) décrit les champs configurables. Les coûts, le tarif de la banque et les points constituent une première base d’équilibrage.
