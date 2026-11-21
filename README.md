# KingBuilder

Le mode multijoueur privé temporaire dispose d’un serveur Node.js sans base de données. Installation locale, déploiement Render gratuit, configuration et administration : [guide multijoueur](docs/multiplayer.md).

Jeu de placement de tuiles en duel, disponible en français et en anglais, jouable à deux sur le même écran. Le terrain est commun : explorez, développez votre économie et disputez les positions adverses.

## Jouer

Node.js 20 ou supérieur suffit, sans installation de dépendances.

```sh
npm start
```

Ouvrir http://127.0.0.1:4173. Solo et Local multiplayer sont disponibles ; le mode bot reste verrouillé. Le multijoueur en ligne permet de créer ou rejoindre un salon privé. Avant chaque nouvelle partie, un menu permet de régler la durée, la préparation, les ressources initiales et la taille de la grille.

Une partie reste active tant que la page reste ouverte. Choisir un mode depuis le menu lance une nouvelle partie. Les réglages proposent aussi un interrupteur « Missions communes », activé par défaut : le désactiver retire les objectifs et leurs récompenses pour cette partie. En ligne, ce choix appartient à l’hôte.

## Traductions

Le drapeau du menu principal bascule entre le français et l’anglais à chaque clic. Le français est utilisé au premier lancement ; le choix est ensuite conservé dans le navigateur.

L’anglais est la langue de référence des données et des messages du moteur. Les JSON de `config/` contiennent les noms, descriptions, motifs et intentions en anglais. Les traductions françaises sont regroupées dans `src/locales/fr.js`. Les textes généraux de l’interface ont leur référence anglaise dans `src/locales/en.js`. Les vues utilisent `t(clé, paramètres)` ; les paramètres `{0}`, `{1}`, etc. peuvent être réordonnés selon la langue. Les traductions ne contiennent pas la mise en page HTML.

Les noms et descriptions du catalogue utilisent des clés fondées sur les identifiants de configuration, par exemple `buildings.house.name`. Les textes statiques déclarent leur clé avec `data-i18n` et les attributs accessibles avec `data-i18n-aria-label`, `data-i18n-title` ou `data-i18n-placeholder`. Pour modifier un bâtiment, une mission, un terrain, une tuile ou une carte, éditer le texte anglais dans son JSON puis sa traduction dans `fr.js`. Les textes des JSON sont enregistrés automatiquement comme références anglaises : ne pas les recopier dans `en.js`. Une traduction française absente affiche le texte anglais du JSON. Pour les textes généraux de l’interface, modifier `en.js` et `fr.js`. Les tests vérifient les clés, les paramètres et la couverture des configurations. Le français reste la langue affichée par défaut.

### Editing game content

English is the source language. Edit names, descriptions, placement patterns and tile intents directly in `config/**/*.json`, then update the matching key in `src/locales/fr.js` (for example, `buildings.farm.name` or `maps.valley.description`). Do not duplicate JSON text in `src/locales/en.js`: it is registered automatically when the configuration loads. New content without a French translation falls back to its English JSON text. General UI messages live in `src/locales/en.js`, with French translations in `fr.js`; preserve their `{0}`, `{1}`, etc. placeholders. The display language defaults to French independently of the source language.

## Règles du duel

### Victoire

- Occuper le donjon adverse avec au moins un soldat survivant donne une victoire immédiate.
- Sinon, après le nombre de tours choisi (25 par défaut, de 20 à 40) pour chaque joueur, additionner les points des bâtiments, des drapeaux contrôlés et de l’or restant. Une égalité donne une victoire partagée.
- Chaque bâtiment ordinaire rapporte 1 point ; un monument en rapporte 4 ; chaque drapeau vaut 4 points. Le donjon et le défrichement ne rapportent rien.
- Chaque paire de pièces d’or restant en stock rapporte 1 point. Les terrains révélés, les ouvriers, les soldats, la nourriture et les matériaux ne rapportent aucun point.

### Plateau et placement

- Plateau de 13 × 13 par défaut, réglable de 9 × 9 à 13 × 13 par tailles impaires. Les cinq objectifs s’adaptent à la taille choisie.
- Les deux ouvriers de chaque joueur commencent au milieu des bords opposés, chacun sur son donjon. Les trois cases directement voisines par un bord sont des plaines déjà révélées et sans propriétaire ; les diagonales restent inexplorées.
- Avant le tour 1, chaque joueur place de 0 à 2 grandes tuiles terrain (0 par défaut), en commençant par J2 en local. Les offres sont communes et ne se renouvellent pas pendant cette préparation. Ces poses ne consomment ni tour ni action et ne remplissent pas les missions.
- Cinq drapeaux neutres sont préplacés et déjà révélés : un au centre, quatre autour du centre.
- Les joueurs révèlent des tuiles de terrain depuis un marché commun de quatre offres. Les terrains restent utilisables par les deux joueurs.
- Les empreintes des bâtiments et leurs terrains requis forment le puzzle. Tous les éléments du motif doivent être révélés et respecter les terrains. Les annexes compatibles peuvent se chevaucher ; seules les cases occupées par un bâtiment lui-même bloquent une autre construction. L’entrée doit être à une case maximum du bâtisseur, sans diagonale.
- Le marché initial propose quatre familles différentes de bâtiments à une étoile. La maison appartient au niveau deux étoiles et arrive après le déblocage des bâtiments avancés.
- Niveaux : 0 étoile pour défrichement, pont et tunnel ; 1 étoile pour les fermes, scieries, carrières, mines et pêcheurs ; 2 étoiles pour les ports et tous les autres bâtiments.
- Les montagnes et les rivières sont infranchissables, sauf sur une case rendue praticable par un bâtiment (tunnel, pont, tour ou producteur). Les joueurs doivent préserver leurs accès.
- Seuls les bâtiments, leurs annexes et les drapeaux contrôlés portent des contours de propriété. Les terrains explorés n’appartiennent à personne.

### Ressources et commerce

| Ressource | Production | Utilisation |
| --- | --- | --- |
| Nourriture | Fermes et pêcheurs | Maisons, casernes, recrutement |
| Matériaux | Scieries et carrières | Construction |
| Or | Mines, ports et missions | Banque, bâtiments avancés et relances |

Un ouvrier sur son bâtiment producteur peut utiliser son action Produire : il gagne immédiatement 2 ressources. Chaque bâtiment produit une seule fois par tour, quel que soit le nombre d’ouvriers. Un moulin voisin d’un champ allié ajoute +1 à la ferme, sans cumul. En fin de tour, chaque ouvrier qui a encore son action produit automatiquement sur sa case, dans la limite d’une production par bâtiment et par tour.

À la construction ou au recrutement, les ressources manquantes peuvent être achetées à la banque. Chaque ressource coûte **2 ors + 1 par bâtiment adverse capable de la produire**, même sans ouvrier. Le paiement utilise d’abord les stocks disponibles. L’or lui-même ne s’achète pas. L’achat ne permet pas de stocker des ressources supplémentaires.

La construction affiche un complément d’achat à confirmer. Le bouton de recrutement montre son coût réel, achat à la banque compris.

Pour 1 or, un ouvrier peut révéler une case voisine du terrain de son choix (plaine, forêt, montagne ou rivière). Cet achat consomme son action d’exploration et ne retire aucune tuile de la pioche.

L’or remplace le prestige : les missions donnent de l’or ; renouveler les quatre offres d’un marché coûte 1 or, une fois par joueur et par tour. Les missions continuent à exiger une contribution après leur apparition, et montent de difficulté après leur attribution.

Départ par défaut : deux ouvriers mobiles au donjon, 3 matériaux, 2 nourritures et 2 ors. Chaque ressource peut être réglée de 0 à 10 avant la partie. Le second joueur reçoit toujours 1 or supplémentaire.

### Ouvriers et maisons

Une maison coûte 3 nourritures et 3 matériaux. Elle ajoute un ouvrier sur sa case, grisé jusqu’au prochain tour du propriétaire. Il n’existe pas de recrutement séparé d’ouvriers.

### Développement et production

Chaque ouvrier dispose de 3 déplacements orthogonaux et d’une action : explorer, construire ou produire. Il peut se déplacer avant et après son action, sans dépasser ses 3 déplacements. Les ouvriers ne combattent pas.

Produire sur une plaine libre donne 1 nourriture ; sur une forêt libre, 1 matériau. Sur son bâtiment producteur, seul le rendement indiqué du bâtiment s’applique. Les bâtiments passifs, les annexes et les drapeaux ne permettent pas la production de terrain libre.

Le roi, l’émissaire et la Chancellerie ont été supprimés. Les états de partie des anciennes règles ne sont plus compatibles ; commencer une nouvelle partie.

### Casernes et armées

- Une caserne coûte 1 nourriture et 2 matériaux sans fournir de soldat gratuit.
- Chaque caserne permet ensuite de recruter un soldat par tour pour 1 nourriture, éventuellement achetées à la banque.
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

### Drapeaux, tours et donjons

Un soldat qui occupe un drapeau le capture. Sa couleur et ses points persistent après le départ de l’armée, jusqu’à une recapture.

Une tour coûte 2 matériaux et peut être construit sur **toute case révélée sans bâtiment**, quel que soit le terrain, y compris sur une annexe compatible. Sa case devient praticable. Construire sur un drapeau en prend le contrôle ; le drapeau n’est pas un bâtiment et peut coexister avec la tour.

La tour et le donjon possèdent une garnison fixe de 1 soldat. Une armée alliée peut les renforcer. Appliquer le bonus défensif +1 une seule fois. La garnison est retirée en dernier et reste présente tant qu’aucun attaquant survivant n’occupe la case, même après une égalité des forces. Ainsi, 2 attaquants ne détruisent pas une tour isolée ; 3 la détruisent avec 1 survivant.

### Destruction et retour des bâtisseurs

Occuper la case réelle d’un bâtiment adverse le détruit. Les terrains annexes ne sont pas des cibles militaires. Toute l’empreinte est libérée ; les terrains restent révélés et les champs reviennent à leur terrain sous-jacent. Les ouvriers restent sur le plateau ; une occupation ennemie les renvoie au donjon.

Détruire une maison ne supprime pas son ouvrier. Détruire une caserne ne supprime pas ses soldats déjà recrutés.

Un ouvrier capturé retourne au donjon, grisé jusqu’à son prochain tour. Occuper le donjon termine immédiatement la partie.

## Commandes

- Cliquer une carte affiche ses placements ; cliquer une case verte la pose. Le glisser-déposer reste disponible.
- Le mode **Jouer** ne sélectionne aucune unité automatiquement : cliquer d’abord un ouvrier ou un soldat, puis sa destination. Le mode **Inspecter** affiche les informations des cases sans déplacer les pièces. Un changement de mode, Échap, un clic droit ou un nouveau tour retire la sélection.
- Pour une armée, l’épée indique la puissance du groupe sélectionné ; le bouclier indique la défense de sa case, avec tous les soldats présents, la garnison éventuelle et le bonus défensif. Le nombre de soldats reste affiché sur le pion du plateau.
- Les quatre pictogrammes sous les tuiles de terrain permettent d’acheter une case précise pour 1 or.
- Sur ordinateur, R ou la molette sur une carte fait pivoter la pièce ; Échap annule la sélection.
- Sur téléphone, toucher une carte puis une case permet de la poser ; sa poignée ⠿ permet aussi de la glisser. La barre de placement reste accessible en bas de l’écran pour pivoter ou annuler. Glisser près du bord fait défiler la page ou le plateau.
- Les ouvriers se glissent vers les producteurs, ou se sélectionnent par un toucher avant de choisir un bâtiment. Le plateau peut défiler sur les petits écrans pour conserver des cases utilisables.
- Le clic droit efface la sélection. Le bouton ↶ annule une seule dernière action ; il se réactive après une nouvelle action et se vide au changement de tour.
- Sélectionner une unité puis une case dorée la déplace. Sélectionner une cible rouge prépare un combat.
- Pour une armée, le sélecteur **Effectif** choisit combien de pions partent ensemble.
- Le panneau Ouvriers permet de sélectionner chaque ouvrier et affiche ses déplacements restants et son action. Le bouton Produire indique le gain sur sa case.
- Les fiches ⓘ et les règles contiennent les explications ; les cartes privilégient les pictogrammes.

## Développement et configuration

```sh
npm test
npm run check:config
npm run build
```

Les valeurs par défaut du plateau, de la durée et des ressources viennent de `config/game-rules.json` et `config/resources.json`. Le menu et le moteur utilisent les mêmes réglages.

`src/` contient le moteur et l’interface ; `config/` contient les règles et les catalogues ; `assets/textures/` contient les illustrations. Le build recopie les sources dans `dist/`, seul dossier à publier. Ne pas modifier `dist/` directement.

Le guide [config/README.md](config/README.md) décrit les champs configurables. Les coûts, le tarif de la banque et les points constituent une première base d’équilibrage.
