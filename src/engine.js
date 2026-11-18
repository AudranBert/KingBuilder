import {
  PRESTIGE,
  MISSIONS,
  emptyProgress,
  initializePrestige,
  settleMissions,
  buildingPayment,
  rerollError,
} from "./prestige.js";
export {
  PRESTIGE,
  MISSIONS,
  missionProgress,
  missionTarget,
  buildingPayment,
  rerollError,
} from "./prestige.js";
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
  RECRUITMENT_COST,
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
  RECRUITMENT_COST,
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
    if (withinRange(x, y, tx, ty, bonus.range))
      multiplier = Math.max(multiplier, bonus.multiplier);
  }
  return definition.production * multiplier;
}
export function migrateGame(g) {
  for (const cell of Object.values(g.board)) {
    if (cell.overlay?.role === "field") cell.terrain = "field";
  }
  // Older saves did not track replacements; preserve their unlocked market.
  g.buildingReplacements ??= RULES.markets.advancedFromReplacement;
  g.workerRecruitsUsed ??= g.recruited ? 1 : 0;
  if (g.version === 1) {
    g.version = 2;
    g.buildingDeck.push(
      ...Array.from({ length: 18 }, (_, i) =>
        i % 2 ? "mill" : "clearing",
      ).filter((id) => BUILDINGS[id]),
    );
  }
  if (g.version === 2 || g.version === 3) {
    g.players.forEach((p, owner) => {
      const legacy = Object.entries(g.board)
        .filter(([, c]) => c.building?.owner === owner && c.building.worker)
        .map(([k]) => k);
      const occupied = new Set();
      p.workerAssignments = Array.from({ length: p.workers }, (_, id) => {
        const pawn = p.workerPawns?.[id],
          pos = pawn ? key(pawn.x, pawn.y) : legacy[id],
          b = pos && g.board[pos]?.building;
        const target =
          b?.owner === owner &&
          BUILDINGS[b.type]?.produces &&
          !occupied.has(pos)
            ? pos
            : null;
        if (target) occupied.add(target);
        return { id, building: target };
      });
      delete p.workerPawns;
    });
    Object.values(g.board).forEach((c) => {
      if (c.building) delete c.building.worker;
    });
    g.version = 4;
    g.log.unshift(
      "Les ouvriers s’affectent directement aux bâtiments, sans déplacement.",
    );
  }
  for (const c of Object.values(g.board))
    if (c.building && !BUILDINGS[c.building.type])
      throw Error(
        "Cette sauvegarde utilise un bâtiment supprimé de la configuration. Une copie de la sauvegarde sera conservée.",
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
          "Cette sauvegarde utilise une unité supprimée de la configuration.",
        );
  if (
    g.selectedUnitId !== null &&
    !g.players[g.active].units.some((u) => u.id === g.selectedUnitId)
  )
    g.selectedUnitId = null;
  initializePrestige(g);
  return g;
}
export function workersAt(g, owner, x, y) {
  return g.players[owner].workerAssignments.filter(
    (w) => w.building === key(x, y),
  );
}
export function workerAssignmentError(g, id, x, y) {
  if (g.finished) return "La partie est terminée.";
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
const inside = (x, y) => withinBoard(x, y, RULES.size);
const shuffle = (a, rng) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function createGame(rng = Math.random, mode = "local") {
  if (!["solo", "local"].includes(mode))
    throw Error("Mode de jeu indisponible.");
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
  for (let i = 0; i < RULES.markets.buildingSize; i++) {
    const index = buildingDeck.findIndex(id => BUILDINGS[id].tier <= RULES.markets.initialMaxTier);
    buildingMarket.push(...buildingDeck.splice(index, 1));
  }
  const players = RULES.players
    .slice(0, mode === "solo" ? 1 : RULES.players.length)
    .map(p => ({
      name: p.name,
      x: Math.min(RULES.size - 1, Math.floor(p.start.x * RULES.size)),
      y: Math.min(RULES.size - 1, Math.floor(p.start.y * RULES.size)),
    }))
    .map((p, owner) => ({
      ...p,
      resources: { ...RULES.startResources },
      workers: RULES.startingWorkers,
      units: [],
      workerAssignments: Array.from({ length: RULES.startingWorkers }, (_, id) => ({ id, building: null })),
      revealed: 0,
      prestige:
        owner === 0
          ? PRESTIGE.firstPlayerStartingAmount
          : PRESTIGE.startingAmount,
      progress: emptyProgress(),
    }));
  const board = {};
  players.forEach((p, i) => {
    const candidates = [0, 1, 2, 3].map((rotation) => ({
      rotation,
      cells: patternAt(CONFIG.startingBuilding, p.x, p.y, rotation),
    }));
    const chosen = candidates.find(({ cells }) =>
      cells.every((c) => inside(c.x, c.y) && !board[key(c.x, c.y)]),
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
  const game = {
    version: 4,
    mode,
    boardSize: RULES.size,
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
  initializePrestige(game, shuffle(Object.keys(MISSIONS), rng));
  return game;
}
export function score(g, i) {
  const p = g.players[i];
  const buildings = Object.values(g.board).filter(
    (c) => c.building?.owner === i,
  ).length;
  return {
    tiles: p.revealed * RULES.points.tile,
    buildings: buildings * RULES.points.building,
    workers: p.workers * UNIT_DEFINITIONS.worker.points * RULES.points.unit,
    units: (p.units || []).reduce(
      (n, u) => n + (UNIT_DEFINITIONS[u.type].points || 0) * RULES.points.unit,
      UNIT_DEFINITIONS.king.points * RULES.points.unit,
    ),
    prestige: (p.prestige || 0) * RULES.points.prestige,
    resources: Math.floor(
      Object.entries(RESOURCE_DEFINITIONS).reduce(
        (sum, [id, r]) => sum + (r.calculated ? 0 : (p.resources[id] || 0) * r.points), 0,
      ) * RULES.points.resource,
    ),
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
}
export function pawns(g, owner) {
  const p = g.players[owner];
  if (!p) return [];
  return [{ id: null, type: "king", x: p.x, y: p.y }, ...(p.units || [])];
}
const enemyAt = (g, x, y) =>
  pawns(g, 1 - g.active).some((p) => p.x === x && p.y === y);
export function moveError(g, x, y) {
  if (g.finished) return "La partie est terminée.";
  const unit = actor(g);
  if (unit.moves < 1 || unit.acted || unit.ended)
    return "Cette unité a terminé ses déplacements.";
  if (!inside(x, y) || distance(unit, { x, y }) !== 1)
    return "Choisissez une case voisine, sans diagonale.";
  if (enemyAt(g, x, y)) return "Un pion adverse occupe cette case.";
  if (g.board[key(x, y)] && !walkable(g.board[key(x, y)]))
    return "Ce terrain est infranchissable.";
  return null;
}
export function move(g, x, y) {
  const error = moveError(g, x, y);
  if (error) throw Error(error);
  if (!g.board[key(x, y)]) return "explore";
  updateActor(g, { x, y, moves: actor(g).moves - 1 });
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
export function placement(g, index, x, y, rotation = 0, anchor = 0) {
  const tile = g.tileMarket[index];
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
    cells.some((c) => !inside(c.x, c.y) || g.board[key(c.x, c.y)])
  )
    return null;
  return cells;
}
export function exploreError(g, index, x, y, rotation = 0, anchor = 0) {
  if (g.finished) return "La partie est terminée.";
  const unit = actor(g);
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
    (c) => (g.board[key(c.x, c.y)] = { terrain: c.terrain, owner: g.active }),
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
export function buildError(
  g,
  index,
  x,
  y,
  rotation = 0,
  { allowPrestige = false } = {},
) {
  const type = g.buildingMarket[index],
    b = BUILDINGS[type],
    p = g.players[g.active],
    unit = actor(g);
  if (g.finished) return "La partie est terminée.";
  if (unit.acted || unit.ended)
    return "Votre action de construction / exploration est déjà terminée.";
  if (!b) return "Choisissez une tuile bâtiment.";
  if (b.constructible === false) return "Ce bâtiment est réservé au départ et ne peut pas être construit.";
  if (!isRotation(rotation)) return "Orientation de bâtiment incorrecte.";
  const cells = patternAt(type, x, y, rotation);
  for (const c of cells) {
    if (!inside(c.x, c.y)) return "Le motif sort du plateau.";
    const target = g.board[key(c.x, c.y)];
    if (!target) return "Toutes les cases du motif doivent être explorées.";
    if (target.building || target.overlay)
      return "Le motif chevauche une tuile bâtiment existante.";
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
    !(allowPrestige && buildingPayment(g, index)?.affordable)
  ) {
    const missing = Object.entries(b.cost).flatMap(([id, n]) => {
      const held = Number.isFinite(p.resources[id]) ? p.resources[id] : 0;
      return n > held ? [`${n - held} ${RESOURCES[id].toLowerCase()}`] : [];
    });
    return `Ressources insuffisantes : il manque ${missing.join(", ")} (prestige insuffisant).`;
  }
  return null;
}
export function build(
  g,
  index,
  x,
  y,
  rotation = 0,
  { allowPrestige = false, expectedPrestige } = {},
) {
  available(g);
  const error = buildError(g, index, x, y, rotation, { allowPrestige });
  if (error) throw Error(error);
  const type = g.buildingMarket[index],
    b = BUILDINGS[type],
    p = g.players[g.active];
  const payment = buildingPayment(g, index);
  if (expectedPrestige !== undefined && payment?.prestige !== expectedPrestige)
    throw Error("Le coût en prestige a changé. Confirmez à nouveau.");
  if (
    payment?.prestige &&
    (!allowPrestige || expectedPrestige !== payment.prestige)
  )
    throw Error("Confirmez l’utilisation du prestige.");
  payCost(p.resources, payment.resources);
  p.prestige -= payment.prestige;
  if (b.transformTo) g.board[key(x, y)].terrain = b.transformTo;
  else {
    g.board[key(x, y)].building = { type, owner: g.active, rotation };
    p.progress.built[type] = (p.progress.built[type] || 0) + 1;
    patternAt(type, x, y, rotation)
      .filter((c) => c.role !== "building")
      .forEach((c) => {
          if (c.transformTo) g.board[key(c.x, c.y)].terrain = c.transformTo;
          g.board[key(c.x, c.y)].overlay = {
            anchor: key(x, y),
            role: c.role,
            owner: g.active,
          };
      });
  }
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
export const housing = (g, i) =>
  Object.values(g.board).reduce(
    (n, c) =>
      n +
      (c.building?.owner === i ? BUILDINGS[c.building.type].housing || 0 : 0),
    0,
  );
export const population = (g, i) =>
  UNIT_DEFINITIONS.king.population +
  g.players[i].workers * UNIT_DEFINITIONS.worker.population +
  (g.players[i].units || []).reduce(
    (n, u) => n + UNIT_DEFINITIONS[u.type].population,
    0,
  );
export function trainError(g, x, y, type) {
  if (g.finished) return "La partie est terminée.";
  const b = g.board[key(x, y)]?.building,
    def = BUILDINGS[b?.type],
    unit = UNIT_DEFINITIONS[type];
  if (!b || b.owner !== g.active || !unit || ["king", "worker"].includes(type) || !def.trains?.includes(type))
    return "Choisissez une de vos casernes et une unité disponible.";
  if (b.trainingRound === g.round && (b.trainedCount || 0) >= def.trainingLimit)
    return "Cette caserne a déjà recruté ce tour-ci.";
  if (population(g, g.active) + unit.population > housing(g, g.active))
    return `Il manque ${unit.population} place(s) libre(s) de logement pour ${unit.name.toLowerCase()}.`;
  if (enemyAt(g, x, y)) return "Un pion adverse occupe la caserne.";
  if (!canAfford(g.players[g.active].resources, unit.cost))
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
  payCost(p.resources, def.cost);
  const unit = {
    id: Math.max(-1, ...p.units.map((u) => u.id)) + 1,
    type,
    x,
    y,
    moves: 0,
    acted: true,
    ended: true,
  };
  p.units.push(unit);
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
export function recruitError(g) {
  if (g.finished) return "La partie est terminée.";
  if ((g.workerRecruitsUsed ?? (g.recruited ? 1 : 0)) >= RULES.workerRecruitmentLimitPerTurn)
    return `Limite de recrutement atteinte : ${RULES.workerRecruitmentLimitPerTurn} ${UNIT_DEFINITIONS.worker.name.toLowerCase()} par tour.`;
  if (!canAfford(g.players[g.active].resources, RECRUITMENT_COST))
    return "Ressources insuffisantes pour recruter.";
  if (population(g, g.active) + UNIT_DEFINITIONS.worker.population > housing(g, g.active))
    return `Il manque ${UNIT_DEFINITIONS.worker.population} place(s) libre(s) de logement pour ${UNIT_DEFINITIONS.worker.name.toLowerCase()}.`;
  return null;
}
export function recruit(g) {
  const error = recruitError(g);
  if (error) throw Error(error);
  const p = g.players[g.active];
  payCost(p.resources, RECRUITMENT_COST);
  p.workerAssignments.push({
    id: Math.max(-1, ...p.workerAssignments.map((w) => w.id)) + 1,
    building: null,
  });
  p.workers = p.workerAssignments.length;
  g.workerRecruitsUsed = (g.workerRecruitsUsed ?? (g.recruited ? 1 : 0)) + 1;
  g.recruited = true;
  p.progress.recruited++;
  note(g, `${p.name} recrute : ${UNIT_DEFINITIONS.worker.name.toLowerCase()}, disponible immédiatement.`);
  awardMissions(g);
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
  if (lastPlayer && g.round >= RULES.rounds) {
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
  g.moves = UNIT_DEFINITIONS.king.moves;
  g.acted = false;
  g.kingEnded = false;
  g.recruited = false;
  g.workerRecruitsUsed = 0;
  g.rerollsUsed = 0;
  g.players[g.active].units.forEach((u) => {
    u.moves = UNIT_DEFINITIONS[u.type].moves;
    u.acted = false;
    u.ended = false;
  });
}

// Reachable revealed cells and shortest paths for the selected unit.
export function movementPaths(g) {
  const unit = actor(g),
    paths = new Map();
  if (g.finished || unit.acted || unit.ended || unit.moves < 1) return paths;
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
        !inside(x, y) ||
        !walkable(g.board[k]) ||
        enemyAt(g, x, y)
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
      `${g.players[g.active].name} : ${MISSIONS[id].name} (+${MISSIONS[id].reward.prestige} prestige).`,
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
  g.players[g.active].prestige -= PRESTIGE.rerollCost;
  g.rerollsUsed++;
  note(
    g,
    `${g.players[g.active].name} relance le marché (${PRESTIGE.rerollCost} prestige).`,
  );
}
