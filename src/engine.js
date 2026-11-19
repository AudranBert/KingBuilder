import {
  GOLD,
  MISSIONS,
  emptyProgress,
  initializeMissions,
  settleMissions,
  buildingPayment,
  costPayment,
  rerollError,
} from "./objectives.js";
export {
  GOLD,
  MISSIONS,
  missionProgress,
  missionTarget,
  buildingPayment,
  costPayment,
  rerollError,
} from "./objectives.js";
import {
  key,
  parseKey,
  distance,
  rotatePoint,
  isRotation,
  inside as withinBoard,
} from "./geometry.js";
import { canAfford, payCost } from "./economy.js";
export { key } from "./geometry.js";
import {
  CONFIG,
  START_RESOURCES,
  RESOURCE_DEFINITIONS,
  BUILDINGS,
  UNIT_DEFINITIONS,
  TERRAINS,
} from "./configuration.js";
export {
  BUILDINGS,
  RESOURCES,
  RESOURCE_ICONS,
  RESOURCE_DEFINITIONS,
  UNIT_DEFINITIONS,
  TERRAINS,
} from "./configuration.js";
import { RESOURCES } from "./configuration.js";
export const RULES = {
  ...CONFIG.rules,
  missionRules: CONFIG.missionRules,
  missionMarketSize: CONFIG.missionMarketSize,
  startingBuilding: CONFIG.startingBuilding,
  size: CONFIG.rules.boardSize,
  rounds: CONFIG.rules.turnLimit,
  startResources: START_RESOURCES,
  points: CONFIG.rules.scoring,
};
export const GAME_DEFAULTS = Object.freeze({
  rounds: 25,
  openingTilesPerPlayer: 2,
  boardSize: 11,
  resources: Object.freeze({ material: 3, food: 2, gold: 1 }),
});
export function gameSettings(settings = {}) {
  const resources = { ...GAME_DEFAULTS.resources, ...(settings.resources || {}) };
  const result = {
    rounds: settings.rounds ?? GAME_DEFAULTS.rounds,
    openingTilesPerPlayer:
      settings.openingTilesPerPlayer ?? GAME_DEFAULTS.openingTilesPerPlayer,
    boardSize: settings.boardSize ?? GAME_DEFAULTS.boardSize,
    resources,
  };
  if (!Number.isInteger(result.rounds) || result.rounds < 20 || result.rounds > 40)
    throw Error("Le nombre de tours doit être compris entre 20 et 40.");
  if (!Number.isInteger(result.openingTilesPerPlayer) || result.openingTilesPerPlayer < 0 || result.openingTilesPerPlayer > 4)
    throw Error("Le nombre de tuiles de préparation doit être compris entre 0 et 4.");
  if (!Number.isInteger(result.boardSize) || result.boardSize < 7 || result.boardSize > 15)
    throw Error("La taille de la grille doit être comprise entre 7 et 15.");
  for (const [id, amount] of Object.entries(resources))
    if (!Object.hasOwn(GAME_DEFAULTS.resources, id) || !Number.isInteger(amount) || amount < 0 || amount > 10)
      throw Error("Les ressources de départ doivent être comprises entre 0 et 10.");
  return result;
}
// Every occupied part points to one anchor; only the anchor stores the building.
export function buildingAt(g, x, y) {
  const c = g.board[key(x, y)];
  if (c?.building) return { x, y, building: c.building };
  if (c?.overlay) {
    const [ax, ay] = parseKey(c.overlay.anchor);
    const b = g.board[c.overlay.anchor]?.building;
    if (b) return { x: ax, y: ay, building: b };
  }
  return null;
}
export function buildingPattern(type, rotation = 0) {
  if (!BUILDINGS[type] || !isRotation(rotation)) return [];
  return BUILDINGS[type].cells.map((c) => ({
    ...c,
    ...rotatePoint(c.x, c.y, rotation),
  }));
}
export function patternAt(type, x, y, rotation = 0) {
  return buildingPattern(type, rotation).map((c) => ({
    ...c,
    x: c.x + x,
    y: c.y + y,
  }));
}
function withinRange(x, y, tx, ty, range) {
  const dx = Math.abs(tx - x),
    dy = Math.abs(ty - y);
  return range === "edge" ? dx + dy === 1 : Math.max(dx, dy) === 1;
}
function meetsAdjacency(g, rule, x, y, owner) {
  return Object.entries(g.board).some(([k, c]) => {
    const [tx, ty] = parseKey(k);
    if (!withinRange(x, y, tx, ty, rule.range)) return false;
    const b = rule.building ? c.building : buildingAt(g, tx, ty)?.building;
    return (
      (rule.building
        ? (BUILDINGS[b?.type]?.family || b?.type) === rule.building
        : c.overlay?.role === rule.role) &&
      (!rule.terrain || c.terrain === rule.terrain) &&
      (!rule.owned || b?.owner === owner)
    );
  });
}
export function productionAmount(g, x, y) {
  const b = g.board[key(x, y)]?.building,
    definition = BUILDINGS[b?.type];
  if (!definition?.produces || !workersAt(g, b.owner, x, y).length) return 0;
  let multiplier = 1;
  for (const [k, c] of Object.entries(g.board)) {
    const bonus = BUILDINGS[c.building?.type]?.boost;
    if (
      !bonus ||
      bonus.target !== (definition.family || b.type) ||
      (bonus.owned && c.building.owner !== b.owner)
    )
      continue;
    const [tx, ty] = parseKey(k);
    const reachesFarm = bonus.target === "farm"
      ? Object.entries(g.board).some(([fieldPosition, field]) => {
          if (field.overlay?.role !== "field" || field.overlay.anchor !== key(x, y)) return false;
          const [fx, fy] = parseKey(fieldPosition);
          return withinRange(tx, ty, fx, fy, "edge");
        })
      : withinRange(x, y, tx, ty, bonus.range);
    if (reachesFarm)
      multiplier = Math.max(multiplier, bonus.multiplier);
  }
  return definition.production * multiplier;
}
export function migrateGame(g) {
  if (g.version !== 5) throw Error("Les anciennes règles ne sont plus compatibles.");
  g.boardSize ??= RULES.size;
  g.turnLimit ??= RULES.rounds;
  g.openingTilesPerPlayer ??= GAME_DEFAULTS.openingTilesPerPlayer;
  g.startingResources ??= { ...RULES.startResources };
  if (g.opening) {
    g.opening.perPlayer ??= g.openingTilesPerPlayer;
    g.opening.totalPlacements ??=
      g.opening.perPlayer * g.players.length;
  }
  g.buildingReplacements ??= RULES.markets.advancedFromReplacement;
  for (const cell of Object.values(g.board)) {
    if (cell.overlay?.role === "field") cell.terrain = "field";
  }
  for (const c of Object.values(g.board))
    if (c.building && !BUILDINGS[c.building.type])
      throw Error(
        "Cet état de partie utilise un bâtiment supprimé de la configuration.",
      );
  for (const p of g.players) {
    p.units ??= [];
    for (const [id, definition] of Object.entries(RESOURCE_DEFINITIONS))
      if (!definition.calculated && p.resources[id] === undefined) p.resources[id] = 0;
  }
  g.buildingDeck = g.buildingDeck.filter((id) => BUILDINGS[id]);
  g.buildingMarket = g.buildingMarket.filter((id) => BUILDINGS[id]);
  while (g.buildingMarket.length < RULES.markets.buildingSize && g.buildingDeck.length)
    g.buildingMarket.push(g.buildingDeck.shift());
  while (g.tileMarket.length < RULES.markets.terrainSize && g.tileDeck.length)
    g.tileMarket.push(g.tileDeck.shift());
  for (const [owner, p] of g.players.entries()) {
    const occupied = new Set();
    for (const worker of p.workerAssignments || []) {
      const b = g.board[worker.building]?.building;
      if (
        worker.building !== null &&
        (!b ||
          b.owner !== owner ||
          !BUILDINGS[b.type]?.produces ||
          occupied.has(worker.building))
      )
        worker.building = null;
      if (worker.building !== null) occupied.add(worker.building);
    }
  }
  g.selectedUnitId ??= null;
  g.kingEnded ??= Boolean(g.recruited);
  for (const p of g.players)
    for (const unit of p.units)
      if (!UNIT_DEFINITIONS[unit.type])
        throw Error(
          "Cet état de partie utilise une unité supprimée de la configuration.",
        );
  if (
    g.selectedUnitId !== null &&
    !g.players[g.active].units.some((u) => u.id === g.selectedUnitId)
  )
    g.selectedUnitId = null;
  if (Array.isArray(g.armySelection)) {
    const lead = g.players[g.active].units.find(u => u.id === g.selectedUnitId);
    const selected = g.players[g.active].units.filter(u => g.armySelection.includes(u.id));
    if (lead?.type !== "soldier" || !g.armySelection.includes(lead.id) ||
      selected.length !== g.armySelection.length || selected.some(u => u.type !== "soldier" || u.x !== lead.x || u.y !== lead.y))
      g.armySelection = null;
  }
  initializeMissions(g);
  return g;
}
export function workersAt(g, owner, x, y) {
  return g.players[owner].workerAssignments.filter(
    (w) => w.building === key(x, y),
  );
}
export function workerAssignmentError(g, id, x, y) {
  if (g.finished) return "La partie est terminée.";
  if (g.opening) return "Terminez d’abord la préparation du terrain.";
  const p = g.players[g.active],
    w = p.workerAssignments.find((w) => w.id === id);
  if (!w) return `Choisissez un de vos ${UNIT_DEFINITIONS.worker.name.toLowerCase()}.`;
  if (x === null && y === null) return null;
  const site = buildingAt(g, x, y),
    b = site?.building;
  if (!b || b.owner !== g.active || !BUILDINGS[b.type].produces)
    return "Choisissez votre propre bâtiment de production.";
  if (
    p.workerAssignments.some(
      (other) => other.id !== id && other.building === key(site.x, site.y),
    )
  )
    return `Ce bâtiment accueille déjà un ${UNIT_DEFINITIONS.worker.name.toLowerCase()}.`;
  return null;
}
export function assignWorker(g, id, x, y) {
  const error = workerAssignmentError(g, id, x, y);
  if (error) throw Error(error);
  const w = g.players[g.active].workerAssignments.find((w) => w.id === id),
    site = x === null ? null : buildingAt(g, x, y);
  w.building = site ? key(site.x, site.y) : null;
}
const inside = (g, x, y) => withinBoard(x, y, g.boardSize ?? RULES.size);
const shuffle = (a, rng) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function createGame(rng = Math.random, mode = "local", settings = null) {
  if (!["solo", "local"].includes(mode))
    throw Error("Mode de jeu indisponible.");
  const options = settings === null
      ? {
          rounds: RULES.rounds,
          openingTilesPerPlayer: GAME_DEFAULTS.openingTilesPerPlayer,
          boardSize: RULES.size,
          resources: { ...RULES.startResources },
        }
      : gameSettings(settings),
    size = options.boardSize;
  const tileDeck = shuffle(
    CONFIG.tiles.map((tile, id) => ({
      id,
      definitionId: tile.id,
      shapeId: tile.shapeId,
      name: tile.name,
      intent: tile.intent,
      cells: tile.cells.map((cell) => ({ ...cell })),
    })),
    rng,
  );
  const buildingDeck = shuffle(
    Array.from(
      { length: CONFIG.buildingDeckSize },
      (_, i) => CONFIG.buildingPool[i % CONFIG.buildingPool.length],
    ),
    rng,
  );
  const buildingMarket = [];
  const initialFamilies = new Set();
  for (let i = 0; i < RULES.markets.buildingSize; i++) {
    const index = buildingDeck.findIndex(id => BUILDINGS[id].tier === RULES.markets.initialMaxTier &&
      !initialFamilies.has(BUILDINGS[id].family || id));
    if (index < 0) throw Error("Pas assez de familles différentes pour le marché initial.");
    initialFamilies.add(BUILDINGS[buildingDeck[index]].family || buildingDeck[index]);
    buildingMarket.push(...buildingDeck.splice(index, 1));
  }
  const players = RULES.players
    .slice(0, mode === "solo" ? 1 : RULES.players.length)
    .map(p => ({
      name: p.name,
      x: Math.min(size - 1, Math.floor(p.start.x * size)),
      y: Math.min(size - 1, Math.floor(p.start.y * size)),
    }))
    .map((p, owner) => ({
      ...p,
      resources: {
        ...options.resources,
        gold: options.resources.gold + (owner === 1 ? 1 : 0),
      },
      workers: RULES.startingWorkers,
      units: [],
      workerAssignments: Array.from({ length: RULES.startingWorkers }, (_, id) => ({ id, building: null })),
      revealed: 0,
      nextUnitId: 0,
      home: { x: p.x, y: p.y },
      kingSkip: 0,
      progress: emptyProgress(),
    }));
  const board = {};
  players.forEach((p, i) => {
    const candidates = [0, 1, 2, 3].map((rotation) => ({
      rotation,
      cells: patternAt(CONFIG.startingBuilding, p.x, p.y, rotation),
    }));
    const chosen = candidates.find(({ cells }) =>
      cells.every((c) => inside({ boardSize: size }, c.x, c.y) && !board[key(c.x, c.y)]),
    );
    if (!chosen)
      throw Error(
        "Le motif du bâtiment de départ ne tient pas sur le plateau.",
      );
    for (const c of chosen.cells) {
      const terrain =
        c.terrain.find((id) => TERRAINS[id].walkable) || c.terrain[0];
      board[key(c.x, c.y)] = {
        terrain,
        owner: i,
        ...(c.role === "building"
          ? {
              building: {
                type: CONFIG.startingBuilding,
                owner: i,
                rotation: chosen.rotation,
              },
            }
          : { overlay: { anchor: key(p.x, p.y), role: c.role, owner: i } }),
      };
    }
  });
  for (const p of players) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = p.x + dx, y = p.y + dy;
        if (Math.abs(dx) + Math.abs(dy) === 1 && inside({ boardSize: size }, x,y) && !board[key(x,y)]) board[key(x,y)] = { terrain: "plain" };
      }
    }
  }
  for (const flag of RULES.flags) {
    const x = Math.round((flag.x / (RULES.size - 1)) * (size - 1)),
      y = Math.round((flag.y / (RULES.size - 1)) * (size - 1));
    board[key(x, y)] = { terrain: "plain", flag: { owner: null } };
  }
  const game = {
    version: 5,
    mode,
    boardSize: size,
    turnLimit: options.rounds,
    openingTilesPerPlayer: options.openingTilesPerPlayer,
    startingResources: { ...options.resources },
    players,
    board,
    tileDeck,
    buildingDeck,
    tileMarket: tileDeck.splice(0, RULES.markets.terrainSize),
    buildingMarket,
    buildingReplacements: 0,
    active: 0,
    round: 1,
    moves: UNIT_DEFINITIONS.king.moves,
    acted: false,
    kingEnded: false,
    selectedUnitId: null,
    recruited: false,
    workerRecruitsUsed: 0,
    finished: false,
    log: [
      mode === "solo"
        ? "Votre royaume prend son essor."
        : "Les deux royaumes prennent leur essor.",
    ],
  };
  initializeMissions(game, shuffle(Object.keys(MISSIONS), rng));
  return game;
}
// Shared draft before round one: J2, J1, J2, J1.
export function startOpening(g) {
  if (g.opening || g.round !== 1 || g.active !== 0 || g.players.some(p => p.revealed))
    throw Error("La préparation ne peut commencer qu’avant la partie.");
  const perPlayer = g.openingTilesPerPlayer ?? GAME_DEFAULTS.openingTilesPerPlayer,
    totalPlacements = perPlayer * g.players.length;
  if (!totalPlacements) {
    g.opening = null;
    note(g, "Aucune tuile de préparation : le premier tour commence.");
    return;
  }
  const offerCount = Math.max(5, totalPlacements + 1),
    indexes = g.tileDeck.map((tile, i) => tile.cells.length >= 5 ? i : -1)
      .filter(i => i >= 0).slice(0, offerCount);
  if (indexes.length < offerCount)
    throw Error(`La pioche ne contient pas ${offerCount} grandes tuiles.`);
  const tiles = indexes.map(i => g.tileDeck[i]);
  for (const i of indexes.reverse()) g.tileDeck.splice(i, 1);
  g.opening = { tiles, step: 0, totalPlacements, perPlayer };
  g.active = g.players.length === 2 ? 1 : 0;
  note(g, `Préparation : ${perPlayer} tuile${perPlayer === 1 ? "" : "s"} à poser par joueur.`);
}
export function openingError(g, index, x, y, rotation = 0) {
  if (!g.opening) return "La préparation est terminée.";
  if (g.finished) return "La partie est terminée.";
  if (!Number.isInteger(index) || !g.opening.tiles[index]) return "Choisissez une des tuiles disponibles.";
  return tilePlacement(g, g.opening.tiles[index], x, y, rotation)
    ? null : "Le motif doit tenir sur des cases vides, sans chevauchement.";
}
export function placeOpeningTile(g, index, x, y, rotation = 0) {
  const error = openingError(g, index, x, y, rotation);
  if (error) throw Error(error);
  const cells = tilePlacement(g, g.opening.tiles[index], x, y, rotation);
  for (const c of cells) g.board[key(c.x, c.y)] = { terrain: c.terrain };
  g.opening.tiles.splice(index, 1);
  g.opening.step++;
  if (g.opening.step === g.opening.totalPlacements) {
    g.tileDeck.push(...g.opening.tiles);
    g.opening = null;
    g.active = 0;
    note(g, "Préparation terminée. Le premier tour commence.");
  } else {
    g.active = g.players.length === 2 ? 1 - g.active : 0;
  }
  return cells;
}
export function score(g, i) {
  return {
    buildings: Object.values(g.board).reduce((n, c) => n + (c.building?.owner === i ? BUILDINGS[c.building.type].points ?? RULES.points.building : 0), 0),
    flags: Object.values(g.board).filter(c => c.flag?.owner === i).length * RULES.points.flag,
    ...(g.finished ? { gold: Math.floor(g.players[i].resources.gold / RULES.points.goldPerPoint) } : {}),
  };
}
export const totalScore = (g, i) =>
  Object.values(score(g, i)).reduce((a, b) => a + b, 0);
export function walkable(cell) {
  return (
    cell &&
    (TERRAINS[cell.terrain]?.walkable ||
      BUILDINGS[cell.building?.type]?.traversable)
  );
}
function available(g) {
  if (g.finished) throw Error("La partie est terminée.");
  if (g.opening) throw Error("Terminez d’abord la préparation du terrain.");
}
function note(g, text) {
  g.log.unshift(text);
  g.log = g.log.slice(0, 40);
}
export function actor(g) {
  const p = g.players[g.active];
  if (g.selectedUnitId !== null && g.selectedUnitId !== undefined) {
    const unit = p.units.find((u) => u.id === g.selectedUnitId);
    if (!unit) throw Error("Unité inconnue.");
    return {
      ...unit,
      ...(unit.type === "soldier" ? { count: selectedSoldiers(g).length, moves: Math.min(...selectedSoldiers(g).map(u => u.moves)), acted: selectedSoldiers(g).some(u => u.acted || u.ended) } : {}),
      name: UNIT_DEFINITIONS[unit.type].name + " " + (unit.id + 1),
      icon: UNIT_DEFINITIONS[unit.type].icon,
    };
  }
  return {
    id: null,
    type: "king",
    name: UNIT_DEFINITIONS.king.name,
    icon: UNIT_DEFINITIONS.king.icon,
    x: p.x,
    y: p.y,
    moves: g.moves,
    acted: g.acted,
    ended: g.kingEnded,
  };
}
function updateActor(g, changes) {
  if (actor(g).type === "soldier") {
    for (const unit of selectedSoldiers(g)) Object.assign(unit, changes);
    return;
  }
  const p = g.players[g.active];
  if (g.selectedUnitId !== null && g.selectedUnitId !== undefined) {
    Object.assign(
      p.units.find((u) => u.id === g.selectedUnitId),
      changes,
    );
    return;
  }
  for (const [k, v] of Object.entries(changes)) {
    if (k === "x" || k === "y") p[k] = v;
    else if (k === "ended") g.kingEnded = v;
    else g[k] = v;
  }
}
export function selectUnit(g, id) {
  available(g);
  if (id !== null && !g.players[g.active].units.some((u) => u.id === id))
    throw Error("Choisissez une de vos unités.");
  g.selectedUnitId = id;
  g.armySelection = null;
}
export function pawns(g, owner) {
  const p = g.players[owner];
  if (!p) return [];
  return [{ id: null, type: "king", x: p.x, y: p.y }, ...(p.units || [])];
}
const enemyAt = (g, x, y) =>
  pawns(g, 1 - g.active).some((p) => p.x === x && p.y === y);

export function armyAt(g, owner, x, y) {
  return g.players[owner]?.units.filter(u => u.type === "soldier" && u.x === x && u.y === y) || [];
}
export function selectedSoldiers(g) {
  const p = g.players[g.active], lead = p.units.find(u => u.id === g.selectedUnitId);
  if (lead?.type !== "soldier") return [];
  const pile = armyAt(g, g.active, lead.x, lead.y);
  if (g.armySelection) return pile.filter(u => g.armySelection.includes(u.id));
  return pile.filter(u => Boolean(u.acted || u.ended) === Boolean(lead.acted || lead.ended));
}
export function selectArmy(g, count) {
  available(g);
  const lead = g.players[g.active].units.find(u => u.id === g.selectedUnitId);
  if (lead?.type !== "soldier") throw Error("Choisissez une armée.");
  const ready = armyAt(g, g.active, lead.x, lead.y).filter(u => !u.acted && !u.ended)
    .sort((a,b) => b.moves-a.moves || a.id-b.id);
  if (!Number.isInteger(count) || count < 1 || count > ready.length) throw Error("Effectif invalide.");
  g.armySelection = ready.slice(0, count).map(u => u.id);
  g.selectedUnitId = g.armySelection[0];
}
function hostileSite(g, x, y) {
  const cell = g.board[key(x,y)];
  return Boolean((cell?.building && cell.building.owner !== g.active) ||
    (cell?.flag && cell.flag.owner !== g.active));
}
export function combatPreview(g, x, y) {
  const unit = actor(g), cell = g.board[key(x,y)];
  const owner = g.players.findIndex((_, i) => i !== g.active && pawns(g,i).some(u => u.x === x && u.y === y));
  const defenderOwner = cell?.building && cell.building.owner !== g.active ? cell.building.owner : owner;
  const defenders = defenderOwner >= 0 ? armyAt(g, defenderOwner, x, y).length : 0;
  const garrison = cell?.building?.owner !== g.active ? BUILDINGS[cell?.building?.type]?.garrison || 0 : 0;
  const attack = unit.type === "soldier" ? selectedSoldiers(g).length : 0;
  const defense = defenders + garrison + (defenders + garrison > 0 ? 1 : 0);
  return { attack, defense, defenders, garrison, attackerSurvivors: Math.max(0, attack-defense),
    defenderSurvivors: Math.min(defenders + garrison, Math.max(0, defense-attack)), defenderOwner };
}
export function attackError(g, x, y) {
  if (g.finished) return "La partie est terminée.";
  if (g.opening) return "Terminez d’abord la préparation du terrain.";
  const unit = actor(g);
  if (unit.type !== "soldier") return "Seule une armée peut combattre ou capturer un drapeau.";
  if (unit.acted || unit.ended) return "Cette armée a déjà terminé son action.";
  if (!inside(g,x,y) || distance(unit,{x,y}) !== 1) return "La cible doit être voisine, sans diagonale.";
  const cell = g.board[key(x,y)];
  if (!cell || !walkable(cell)) return "Cette cible est inaccessible.";
  if (!hostileSite(g,x,y) && !enemyAt(g,x,y)) return "Aucune cible adverse ni drapeau neutre sur cette case.";
  return null;
}
export function destroyBuilding(g, x, y) {
  // Only the actual building cell is a military target, never an auxiliary tile.
  const position = key(x,y), cell = g.board[position], b = cell?.building;
  if (!b) return;
  for (const p of g.players)
    for (const worker of p.workerAssignments)
      if (worker.building === position) worker.building = null;
  for (const part of Object.values(g.board)) {
    if (part.overlay?.anchor !== position) continue;
    if (part.overlay.previousTerrain) part.terrain = part.overlay.previousTerrain;
    else if (part.overlay.role === "field") part.terrain = "plain";
    delete part.overlay;
  }
  delete cell.building;
  note(g, `${BUILDINGS[b.type].name} détruit.`);
}
function returnBuilders(g, owner, x, y) {
  const p = g.players[owner];
  if (!p) return;
  if (p.x === x && p.y === y) {
    Object.assign(p, p.home); p.kingSkip = 1;
    note(g, `${p.name} : le roi retourne au donjon et perd son prochain tour d’activation.`);
  }
  for (const unit of p.units) {
    if (unit.type !== "emissary" || unit.x !== x || unit.y !== y) continue;
    const home = unit.home, b = home && g.board[key(home.x,home.y)]?.building;
    Object.assign(unit, b?.owner === owner && b.type === "chancellery" ? home : p.home,
      { moves:0, acted:true, ended:true, skipTurns:1 });
  }
}
export function attack(g, x, y) {
  const error = attackError(g,x,y);
  if (error) throw Error(error);
  const p = g.players[g.active], attackers = selectedSoldiers(g), result = combatPreview(g,x,y),
    cell = g.board[key(x,y)], b = cell.building;
  const defenderOwner = result.defenderOwner;
  if (defenderOwner >= 0) {
    const army = armyAt(g,defenderOwner,x,y);
    // The permanent garrison is removed last and persists until actual occupation.
    const survivors = Math.max(0,result.defenderSurvivors-result.garrison);
    const lost = new Set(army.slice(survivors).map(u => u.id));
    g.players[defenderOwner].units = g.players[defenderOwner].units.filter(u => !lost.has(u.id));
  }
  const survivors = attackers.slice(0,result.attackerSurvivors), lost = new Set(attackers.slice(result.attackerSurvivors).map(u => u.id));
  for (const u of attackers) Object.assign(u,{moves:0,acted:true,ended:true});
  p.units = p.units.filter(u => !lost.has(u.id));
  if (survivors.length) {
    if (b && b.owner !== g.active) {
      if (b.type === RULES.startingBuilding) {
        g.finished = true; g.winner = g.active; g.victory = "conquest";
      } else destroyBuilding(g,x,y);
    }
    for (let i=0;i<g.players.length;i++) if (i !== g.active) returnBuilders(g,i,x,y);
    for (const u of survivors) Object.assign(u,{x,y});
    if (cell.flag) cell.flag.owner = g.active;
  }
  g.selectedUnitId = survivors[0]?.id ?? null;
  g.armySelection = survivors.length ? survivors.map(u => u.id) : null;
  note(g, `Combat ${result.attack} contre ${result.defense} : ${survivors.length} attaquant(s) survivant(s).${g.victory === "conquest" ? " Donjon conquis : victoire immédiate !" : ""}`);
  return result;
}
// Targets accessible within the unit's remaining movement steps. The final occupation
// is an action, not an additional movement point, and cannot be chained.
export function attackPaths(g) {
  const paths = new Map(), unit = actor(g);
  if (g.finished || g.opening || unit.type !== "soldier" || unit.acted || unit.ended) return paths;
  const origins = [[key(unit.x,unit.y),[]],...movementPaths(g)];
  for (const [position,path] of origins) {
    const [x,y] = parseKey(position);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const tx=x+dx,ty=y+dy,k=key(tx,ty);
      if (!inside(g,tx,ty) || !walkable(g.board[k]) || (!hostileSite(g,tx,ty) && !enemyAt(g,tx,ty))) continue;
      if (!paths.has(k)) paths.set(k,path);
    }
  }
  return paths;
}
export function moveError(g, x, y) {
  if (g.finished) return "La partie est terminée.";
  if (g.opening) return "Terminez d’abord la préparation du terrain.";
  const unit = actor(g);
  if (unit.moves < 1 || unit.acted || unit.ended)
    return "Cette unité a terminé ses déplacements.";
  if (!inside(g, x, y) || distance(unit, { x, y }) !== 1)
    return "Choisissez une case voisine, sans diagonale.";
  if (enemyAt(g, x, y)) return "Un pion adverse occupe cette case : utilisez le combat.";
  if (hostileSite(g, x, y)) return "Cette position doit être occupée avec une action de combat.";
  if (g.board[key(x, y)] && !walkable(g.board[key(x, y)]))
    return "Ce terrain est infranchissable.";
  return null;
}
export function move(g, x, y) {
  const error = moveError(g, x, y);
  if (error) throw Error(error);
  if (!g.board[key(x, y)]) {
    if (actor(g).type === "soldier") throw Error("Les soldats ne peuvent pas explorer.");
    return "explore";
  }
  if (actor(g).type === "soldier") {
    for (const soldier of selectedSoldiers(g)) Object.assign(soldier,{x,y,moves:soldier.moves-1});
  } else updateActor(g, { x, y, moves: actor(g).moves - 1 });
  return "moved";
}
export function transformed(tile, rotation = 0, anchor = 0) {
  if (
    !Array.isArray(tile?.cells) ||
    !isRotation(rotation) ||
    !Number.isInteger(anchor) ||
    !tile.cells[anchor] ||
    tile.cells.some((c) => !Number.isInteger(c.x) || !Number.isInteger(c.y))
  )
    return [];
  const origin = tile.cells[anchor];
  return tile.cells.map((c) => {
    return {
      ...rotatePoint(c.x - origin.x, c.y - origin.y, rotation),
      terrain: c.terrain,
    };
  });
}
function tilePlacement(g, tile, x, y, rotation = 0, anchor = 0) {
  if (
    !Array.isArray(tile?.cells) ||
    !tile.cells.length ||
    tile.cells.some((c) => !TERRAINS[c.terrain]) ||
    new Set(tile.cells.map((c) => key(c.x, c.y))).size !== tile.cells.length
  )
    return null;
  const cells = transformed(tile, rotation, anchor).map((c) => ({
    ...c,
    x: c.x + x,
    y: c.y + y,
  }));
  if (
    !cells.length ||
    cells.some((c) => !inside(g, c.x, c.y) || g.board[key(c.x, c.y)])
  )
    return null;
  return cells;
}
export function placement(g, index, x, y, rotation = 0, anchor = 0) {
  return tilePlacement(g, g.tileMarket[index], x, y, rotation, anchor);
}
export function exploreError(g, index, x, y, rotation = 0, anchor = 0) {
  if (g.finished) return "La partie est terminée.";
  if (g.opening) return "Terminez d’abord la préparation du terrain.";
  const unit = actor(g);
  if (unit.type === "soldier") return "Les soldats ne peuvent pas explorer.";
  if (unit.acted || unit.ended) return "Cette unité a déjà terminé son action.";
  if (g.board[key(x, y)]) return "Choisissez une case inexplorée.";
  const cells = placement(g, index, x, y, rotation, anchor);
  if (!cells)
    return "Le motif doit tenir sur des cases vides, sans chevauchement.";
  if (!cells.some((c) => distance(unit, c) === RULES.placement.explorationContactDistance))
    return `Une case de la tuile doit être à ${RULES.placement.explorationContactDistance} case(s) de l’unité, sans diagonale.`;
  return null;
}
export function explore(g, index, x, y, rotation = 0, anchor = 0) {
  const error = exploreError(g, index, x, y, rotation, anchor);
  if (error) throw Error(error);
  const p = actor(g),
    cells = placement(g, index, x, y, rotation, anchor);
  cells.forEach(
    (c) => (g.board[key(c.x, c.y)] = { terrain: c.terrain }),
  );
  g.players[g.active].revealed += cells.length;
  for (const c of cells) {
    const counts = g.players[g.active].progress.terrain;
    counts[c.terrain] = (counts[c.terrain] || 0) + 1;
  }
  updateActor(g, { moves: 0, acted: true });
  if (g.tileDeck.length) g.tileMarket[index] = g.tileDeck.shift();
  else g.tileMarket.splice(index, 1);
  note(g, `${p.name} explore ${cells.length} cases.`);
  awardMissions(g);
}
export function buyTerrainError(g, terrain, x, y) {
  if (g.finished) return "La partie est terminée.";
  if (g.opening) return "Terminez d’abord la préparation du terrain.";
  if (!["plain", "forest", "mountain", "river"].includes(terrain))
    return "Choisissez un terrain disponible.";
  const unit = actor(g);
  if (unit.type === "soldier") return "Les soldats ne peuvent pas explorer.";
  if (unit.acted || unit.ended) return "Cette unité a déjà terminé son action.";
  if (!inside(g, x, y) || g.board[key(x, y)]) return "Choisissez une case inexplorée.";
  if (distance(unit, { x, y }) !== RULES.placement.explorationContactDistance)
    return "La case doit être voisine de l’unité, sans diagonale.";
  if (g.players[g.active].resources.gold < RULES.trade.singleTerrainCost)
    return `Il faut ${RULES.trade.singleTerrainCost} or.`;
  return null;
}
export function buyTerrain(g, terrain, x, y) {
  const error = buyTerrainError(g, terrain, x, y);
  if (error) throw Error(error);
  const p = g.players[g.active];
  p.resources.gold -= RULES.trade.singleTerrainCost;
  g.board[key(x, y)] = { terrain };
  p.revealed++;
  p.progress.terrain[terrain] = (p.progress.terrain[terrain] || 0) + 1;
  updateActor(g, { moves: 0, acted: true });
  note(g, `${p.name} achète une case de ${TERRAINS[terrain].name.toLowerCase()} pour ${RULES.trade.singleTerrainCost} or.`);
  awardMissions(g);
}
export function buildError(
  g,
  index,
  x,
  y,
  rotation = 0,
  { allowGold = false } = {},
) {
  const type = g.buildingMarket[index],
    b = BUILDINGS[type],
    p = g.players[g.active],
    unit = actor(g);
  if (g.finished) return "La partie est terminée.";
  if (g.opening) return "Terminez d’abord la préparation du terrain.";
  if (unit.acted || unit.ended)
    return "Votre action de construction / exploration est déjà terminée.";
  if (unit.type === "soldier") return "Les soldats ne peuvent pas construire.";
  if (!b) return "Choisissez une tuile bâtiment.";
  if (b.unique && (p.units.some(u => u.type === b.onBuildUnit) || Object.values(g.board).some(c => c.building?.owner === g.active && c.building.type === type))) return "Un seul émissaire et une seule Chancellerie par royaume.";
  if (b.constructible === false) return "Ce bâtiment est réservé au départ et ne peut pas être construit.";
  if (!isRotation(rotation)) return "Orientation de bâtiment incorrecte.";
  const cells = patternAt(type, x, y, rotation);
  for (const c of cells) {
    if (!inside(g, c.x, c.y)) return "Le motif sort du plateau.";
    const target = g.board[key(c.x, c.y)];
    if (!target) return "Toutes les cases du motif doivent être explorées.";
    if (target.flag && type !== "outpost") return "Seule une tour peut être construit sur un drapeau.";
    if (target.building || (target.overlay && (c.transformTo || b.transformTo)))
      return "Le motif chevauche une case de bâtiment ou un champ réservé.";
    if (!c.terrain.includes(target.terrain))
      return `${b.name} : terrain incompatible, il faut ${c.terrain.map(id => TERRAINS[id].name.toLowerCase()).join(" ou ")} à la place de ${TERRAINS[target.terrain].name.toLowerCase()}. ${b.pattern}`;
    if (enemyAt(g, c.x, c.y)) return "Un pion adverse occupe le motif.";
  }
  const d = distance(unit, { x, y });
  if (d > RULES.placement.constructionRange)
    return `Placez l’entrée à ${RULES.placement.constructionRange} case(s) maximum de l’unité, sans diagonale.`;
  if (b.adjacency?.some((rule) => !meetsAdjacency(g, rule, x, y, g.active)))
    return `${b.name} : ${b.pattern}`;
  if (
    !canAfford(p.resources, b.cost) &&
    !(allowGold && buildingPayment(g, index)?.affordable)
  ) {
    const missing = Object.entries(b.cost).flatMap(([id, n]) => {
      const held = Number.isFinite(p.resources[id]) ? p.resources[id] : 0;
      return n > held ? [`${n - held} ${RESOURCES[id].toLowerCase()}`] : [];
    });
    return `Ressources insuffisantes : il manque ${missing.join(", ")} (or insuffisant).`;
  }
  return null;
}
export function build(
  g,
  index,
  x,
  y,
  rotation = 0,
  { allowGold = false, expectedGold } = {},
) {
  available(g);
  const error = buildError(g, index, x, y, rotation, { allowGold });
  if (error) throw Error(error);
  const type = g.buildingMarket[index],
    b = BUILDINGS[type],
    p = g.players[g.active];
  const payment = buildingPayment(g, index);
  if (expectedGold !== undefined && payment?.gold !== expectedGold)
    throw Error("Le coût en or a changé. Confirmez à nouveau.");
  if (
    payment?.gold &&
    (!allowGold || expectedGold !== payment.gold)
  )
    throw Error("Confirmez l’achat des ressources à la banque.");
  payCost(p.resources, payment.resources);

  if (b.transformTo) g.board[key(x, y)].terrain = b.transformTo;
  else {
    g.board[key(x, y)].building = { type, owner: g.active, rotation };
    if (type === "outpost" && g.board[key(x,y)].flag) g.board[key(x,y)].flag.owner = g.active;
    p.progress.built[type] = (p.progress.built[type] || 0) + 1;
    patternAt(type, x, y, rotation)
      .filter((c) => c.role !== "building")
      .forEach((c) => {
          const cell = g.board[key(c.x, c.y)];
          const previousTerrain = cell.terrain;
          if (c.transformTo) cell.terrain = c.transformTo;
          if (!cell.overlay) cell.overlay = {
            anchor: key(x, y),
            role: c.role,
            owner: g.active,
            previousTerrain,
          };
      });
  }
  if (b.grantsWorker) {
    for (let n = 0; n < b.grantsWorker; n++) addWorker(g);
  }
  if (b.onBuildUnit) spawnUnit(g, x, y, b.onBuildUnit);
  for (const [resource, amount] of Object.entries(b.onBuildGain || {}))
    p.resources[resource] += amount;
  updateActor(g, { moves: 0, acted: true });
  const replacement = drawBuildingOffers(g, 1);
  if (replacement.length) g.buildingMarket[index] = replacement[0];
  else g.buildingMarket.splice(index, 1);
  note(
    g,
    b.transformTo
      ? `${p.name} utilise : ${b.name.toLowerCase()}.`
      : `${p.name} construit : ${b.name.toLowerCase()}.`,
  );
  awardMissions(g);
}
export function trainError(g, x, y, type) {
  if (g.finished) return "La partie est terminée.";
  if (g.opening) return "Terminez d’abord la préparation du terrain.";
  const b = g.board[key(x, y)]?.building,
    def = BUILDINGS[b?.type],
    unit = UNIT_DEFINITIONS[type];
  if (!b || b.owner !== g.active || !unit || ["king", "worker"].includes(type) || !def.trains?.includes(type))
    return "Choisissez une de vos casernes et une unité disponible.";
  if (b.trainingRound === g.round && (b.trainedCount || 0) >= def.trainingLimit)
    return "Cette caserne a déjà recruté ce tour-ci.";
  if (enemyAt(g, x, y)) return "Un pion adverse occupe la caserne.";
  if (!costPayment(g, unit.cost)?.affordable)
    return "Ressources insuffisantes pour cette unité.";
  return null;
}
export function trainUnit(g, x, y, type) {
  available(g);
  const error = trainError(g, x, y, type);
  if (error) throw Error(error);
  const p = g.players[g.active],
    def = UNIT_DEFINITIONS[type],
    b = g.board[key(x, y)].building;
  payCost(p.resources, costPayment(g, def.cost).resources);
  const unit = spawnUnit(g, x, y, type);
  if (b.trainingRound !== g.round) {
    b.trainingRound = g.round;
    b.trainedCount = 0;
  }
  b.trainedCount++;
  note(g, `${p.name} recrute : ${def.name.toLowerCase()}.`);
  awardMissions(g);
  return unit;
}
export const assigned = (g, i) =>
  g.players[i].workerAssignments.filter((w) => w.building !== null).length;
export function recruitError() { return "Construisez une maison pour obtenir un ouvrier."; }
export function recruit() { throw Error(recruitError()); }
function addWorker(g) {
  const p = g.players[g.active];
  p.workerAssignments.push({ id: Math.max(-1, ...p.workerAssignments.map(w => w.id)) + 1, building: null });
  p.workers = p.workerAssignments.length;
  p.progress.recruited++;
}
function spawnUnit(g, x, y, type) {
  const p = g.players[g.active];
  p.nextUnitId = Math.max(p.nextUnitId || 0, ...p.units.map(u => u.id + 1));
  const unit = { id: p.nextUnitId++, type, x, y, home: {x,y}, moves: 0, acted: true, ended: true, skipTurns: 0 };
  p.units.push(unit);
  return unit;
}
export function assign(g, x, y) {
  available(g);
  const site = buildingAt(g, x, y),
    b = site?.building;
  if (!b || b.owner !== g.active || !BUILDINGS[b.type].produces)
    throw Error("Choisissez votre propre bâtiment de production.");
  const target = key(site.x, site.y),
    p = g.players[g.active],
    current = p.workerAssignments.find((w) => w.building === target);
  if (current) {
    assignWorker(g, current.id, null, null);
    return;
  }
  const free = p.workerAssignments.find((w) => w.building === null);
  if (!free)
    throw Error(
      "Tous vos ouvriers sont affectés. Réaffectez-en un depuis le panneau des ouvriers.",
    );
  assignWorker(g, free.id, site.x, site.y);
}
export function harvestPreview(g, owner = g.active) {
  const amounts = Object.fromEntries(
    Object.entries(RESOURCE_DEFINITIONS)
      .filter(([, definition]) => !definition.calculated)
      .map(([id]) => [id, 0]),
  );
  const inactive = [];
  for (const [position, c] of Object.entries(g.board)) {
    const b = c.building, definition = BUILDINGS[b?.type];
    if (b?.owner !== owner || !definition?.produces) continue;
    const n = productionAmount(g, ...parseKey(position));
    amounts[definition.produces] += n;
    if (!n) inactive.push(position);
  }
  return { amounts, inactive };
}
export function endTurn(g) {
  available(g);
  const p = g.players[g.active];
  const earned = [];
  for (const [r, n] of Object.entries(harvestPreview(g).amounts)) {
    if (!n) continue;
    p.resources[r] += n;
    earned.push(`${n} ${RESOURCES[r].toLowerCase()}`);
  }
  if (earned.length) note(g, `${p.name} récolte : ${earned.join(", ")}.`);
  awardMissions(g);
  const lastPlayer = g.active === g.players.length - 1;
  if (lastPlayer && g.round >= (g.turnLimit ?? RULES.rounds)) {
    g.finished = true;
    note(
      g,
      g.mode === "solo"
        ? "La partie est terminée. Votre royaume est évalué aux points."
        : "La partie est terminée. Les royaumes sont départagés aux points.",
    );
    return;
  }
  if (lastPlayer) g.round++;
  g.active = (g.active + 1) % g.players.length;
  g.selectedUnitId = null;
  g.armySelection = null;
  g.moves = UNIT_DEFINITIONS.king.moves;
  g.acted = false;
  g.kingEnded = false;
  g.recruited = false;
  g.workerRecruitsUsed = 0;
  g.rerollsUsed = 0;
  const next = g.players[g.active];
  if (next.kingSkip > 0) {
    next.kingSkip--;
    g.moves = 0; g.acted = true; g.kingEnded = true;
  }
  g.players[g.active].units.forEach((u) => {
    if (u.skipTurns > 0) {
      u.skipTurns--; u.moves = 0; u.acted = true; u.ended = true;
      return;
    }
    u.moves = UNIT_DEFINITIONS[u.type].moves;
    u.acted = false;
    u.ended = false;
  });
}

// Reachable revealed cells and shortest paths for the selected unit.
export function movementPaths(g) {
  const unit = actor(g),
    paths = new Map();
  if (g.finished || g.opening || unit.acted || unit.ended || unit.moves < 1) return paths;
  const queue = [{ x: unit.x, y: unit.y, path: [] }],
    seen = new Set([key(unit.x, unit.y)]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current.path.length >= unit.moves) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = current.x + dx,
        y = current.y + dy,
        k = key(x, y);
      if (
        seen.has(k) ||
        !inside(g, x, y) ||
        !walkable(g.board[k]) ||
        enemyAt(g, x, y) || hostileSite(g, x, y)
      )
        continue;
      seen.add(k);
      const path = [...current.path, { x, y }];
      paths.set(k, path);
      queue.push({ x, y, path });
    }
  }
  return paths;
}

function awardMissions(g) {
  for (const id of settleMissions(g))
    note(
      g,
      `${g.players[g.active].name} : ${MISSIONS[id].name} (+${MISSIONS[id].reward.gold} or).`,
    );
}
function drawBuildingOffers(g, count) {
  g.buildingReplacements = (g.buildingReplacements ?? RULES.markets.advancedFromReplacement) + 1;
  const offers = [];
  while (offers.length < count) {
    const index = g.buildingDeck.findIndex(
      (id) => g.buildingReplacements >= RULES.markets.advancedFromReplacement || BUILDINGS[id].tier <= RULES.markets.initialMaxTier,
    );
    if (index === -1) break;
    offers.push(...g.buildingDeck.splice(index, 1));
  }
  return offers;
}
export function rerollMarket(g, kind) {
  const error = rerollError(g, kind);
  if (error) throw Error(error);
  const market = kind === "terrain" ? g.tileMarket : g.buildingMarket,
    deck = kind === "terrain" ? g.tileDeck : g.buildingDeck;
  const fresh = kind === "building"
      ? drawBuildingOffers(g, market.length)
      : deck.splice(0, market.length),
    removed = market.splice(0, market.length, ...fresh);
  deck.push(...removed);
  g.players[g.active].resources.gold -= GOLD.rerollCost;
  g.rerollsUsed++;
  note(
    g,
    `${g.players[g.active].name} relance le marché (${GOLD.rerollCost} or).`,
  );
}
