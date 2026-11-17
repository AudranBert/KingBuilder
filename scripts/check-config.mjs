import { CONFIG } from "../dist/configuration.js";
console.log(
  `Configuration valide : ${CONFIG.tiles.length} tuiles prédéfinies, ${Object.keys(CONFIG.terrains).length} terrains, ${Object.keys(CONFIG.shapes).length} formes, ${Object.keys(CONFIG.buildings).length} bâtiments, ${Object.keys(CONFIG.resources).length} ressources, ${Object.keys(CONFIG.units).length} unité(s), ${Object.keys(CONFIG.missions).length} missions. Plateau ${CONFIG.rules.boardSize} × ${CONFIG.rules.boardSize}, ${CONFIG.rules.turnLimit} tours par joueur.`,
);
