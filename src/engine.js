import { message as sourceMessage } from "./i18n.js";
import { MAPS, chooseMap, mapCells } from "./maps.js";
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
import { payCost } from "./economy.js";
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
  mapId: "base",
  rounds: RULES.rounds,
  openingTilesPerPlayer: 0,
  boardSize: RULES.size,
  missionsEnabled: true,
  resources: Object.freeze({ ...START_RESOURCES }),
});
export function gameSettings(settings = {}) {
  const resources = { ...GAME_DEFAULTS.resources, ...(settings.resources || {}) };
  const result = {
    mapId: settings.mapId === undefined ? GAME_DEFAULTS.mapId : settings.mapId,
    rounds: settings.rounds ?? GAME_DEFAULTS.rounds,
    openingTilesPerPlayer:
      settings.openingTilesPerPlayer ?? GAME_DEFAULTS.openingTilesPerPlayer,
    boardSize: settings.boardSize ?? GAME_DEFAULTS.boardSize,
    missionsEnabled: settings.missionsEnabled === undefined ? GAME_DEFAULTS.missionsEnabled : settings.missionsEnabled,
    resources,
  };
  if (result.mapId !== null && result.mapId !== "random" && !MAPS.some(map => map.id === result.mapId))
    throw Error("Carte inconnue.");
  if (!Number.isInteger(result.rounds) || result.rounds < 20 || result.rounds > 40)
    throw Error(sourceMessage("messages.theNumberOfTurnsMustBeBetween"));
  if (!Number.isInteger(result.openingTilesPerPlayer) || result.openingTilesPerPlayer < 0 || result.openingTilesPerPlayer > 2)
    throw Error(sourceMessage("messages.theNumberOfSetupTilesMustBe"));
  if (!Number.isInteger(result.boardSize) || result.boardSize < 9 || result.boardSize > 13 || result.boardSize % 2 === 0)
    throw Error(sourceMessage("messages.theBoardSizeMustBeBetween7"));
  if (typeof result.missionsEnabled !== 'boolean') throw Error(sourceMessage("settings.missionsInvalid"));
  for (const [id, amount] of Object.entries(resources))
    if (!Object.hasOwn(GAME_DEFAULTS.resources, id) || !Number.isInteger(amount) || amount < 0 || amount > 10)
      throw Error(sourceMessage("messages.startingResourcesMustBeBetween0And"));
  return result;
}
// Only the icon cell contains a building. Other pattern cells are placement conditions.
export function buildingAt(g, x, y) {
  const c = g.board[key(x, y)];
  if (c?.building) return { x, y, building: c.building };
  return null;
}
function featureAt(g, x, y, feature) {
  for (const [position, cell] of Object.entries(g.board)) {
    const definition = BUILDINGS[cell.building?.type];
    if (!definition || !(feature === 'field' ? definition.createsFields : definition.greatBridge)) continue;
    const symbol = feature === 'field' ? 'p' : 'r';
    const [ax,ay] = parseKey(position);
    if (patternAt(cell.building.type,ax,ay,cell.building.rotation || 0)
      .some(c => c.symbol === symbol && c.x === x && c.y === y))
      return {x:ax,y:ay,building:cell.building};
  }
  return null;
}
export function terrainAt(g,x,y) {
  const terrain = g.board[key(x,y)]?.terrain;
  return terrain === 'plain' && featureAt(g,x,y,'field') ? 'field' : terrain;
}
export function bridgeAt(g,x,y) {
  return g.board[key(x,y)]?.terrain === 'river' ? featureAt(g,x,y,'bridge') : null;
}
function matchesTerrain(g,cell,x,y,allowed) {
  return allowed.includes(cell.terrain) || allowed.includes(terrainAt(g,x,y));
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
  return range === "radius2" ? dx + dy > 0 && dx + dy <= 2 : range === "edge" ? dx + dy === 1 : Math.max(dx, dy) === 1;
}
export function kingdomBonus(g, owner, field) {
  return Math.max(0,...Object.values(g.board).filter(c=>c.building?.owner===owner).map(c=>Number(BUILDINGS[c.building.type]?.[field] || 0)));
}
function nearbyBuildings(g,owner,x,y){return Object.entries(g.board).flatMap(([k,c])=>{const [tx,ty]=parseKey(k);return c.building?.owner===owner && withinRange(x,y,tx,ty,'radius2') ? [{x:tx,y:ty,building:c.building}] : [];});}
function unitWalkable(g,cell,x,y){return walkable(cell)||(cell?.terrain==='river' && (kingdomBonus(g,g.active,'waterMovement') || bridgeAt(g,x,y)));}
export function trainingCapacity(g,x,y){const b=g.board[key(x,y)]?.building;return (BUILDINGS[b?.type]?.trainingLimit||0)+(b && nearbyBuildings(g,b.owner,x,y).some(v=>BUILDINGS[v.building.type].trainingBoost)?1:0);}
export function productionAmount(g, x, y) {
  const b = g.board[key(x, y)]?.building,
    definition = BUILDINGS[b?.type];
  if (!definition?.produces) return 0;
  let bonusAmount = 0;
  for (const [k, c] of Object.entries(g.board)) {
    const bonus = BUILDINGS[c.building?.type]?.boost;
    if (
      !bonus ||
      bonus.target !== (definition.productionFamily || definition.family || b.type) ||
      (bonus.owned && c.building.owner !== b.owner)
    )
      continue;
    const [tx, ty] = parseKey(k);
    const reachesFarm = withinRange(x, y, tx, ty, bonus.range);
    if (reachesFarm)
      bonusAmount = Math.max(bonusAmount, bonus.bonus || 1);
  }
  if (definition.toll) return nearbyBuildings(g, b.owner, x, y).filter(v => BUILDINGS[v.building.type].tier === 1 && BUILDINGS[v.building.type].produces).length;
  if (definition.portBonus) bonusAmount += nearbyBuildings(g,b.owner,x,y).filter(v => ['market','fisher'].includes(BUILDINGS[v.building.type].productionFamily || BUILDINGS[v.building.type].family || v.building.type)).length;
  return definition.production + bonusAmount;
}
const inside = (g, x, y) => withinBoard(x, y, g.boardSize ?? RULES.size);
const shuffle = (a, rng) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function createGame(rng = Math.random, mode = "local", settings = {}) {
  if (!["solo", "local"].includes(mode))
    throw Error(sourceMessage("messages.gameModeUnavailable"));
  const options = gameSettings(settings ?? {}), size = options.boardSize;
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
    if (index < 0) throw Error(sourceMessage("messages.notEnoughDifferentFamiliesForTheInitial"));
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
      units: Array.from({ length: RULES.startingWorkers }, (_, id) => ({
        id, type: "worker", x: p.x, y: p.y, home: { x:p.x, y:p.y },
        moves: UNIT_DEFINITIONS.worker.moves, acted:false, ended:false, skipTurns:0,
      })),
      revealed: 0,
      nextUnitId: RULES.startingWorkers,
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
        sourceMessage("messages.theStartingBuildingPatternDoesNotFit"),
      );
    for (const c of chosen.cells) {
      const terrain =
        c.terrain.find((id) => TERRAINS[id].walkable) || c.terrain[0];
      board[key(c.x, c.y)] = {
        terrain,
        owner: i,
        ...(c.symbol === 'B'
          ? {
              building: {
                type: CONFIG.startingBuilding,
                owner: i,
                rotation: chosen.rotation,
              },
            }
          : {}),
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
  const selectedMap = options.mapId ? chooseMap(options.mapId, rng) : null;
  if (selectedMap) {
    for (const [position, cell] of mapCells(selectedMap, size)) {
      // Home buildings and their access cells are reserved before map placement.
      if (board[position]) throw Error(`Carte ${selectedMap.id} : la carte empiète sur un départ en ${position}.`);
      board[position] = cell;
    }
  }
  for (const flag of selectedMap ? [] : RULES.flags) {
    const x = Math.round((flag.x / (RULES.size - 1)) * (size - 1)),
      y = Math.round((flag.y / (RULES.size - 1)) * (size - 1));
    board[key(x, y)] = { terrain: "plain", flag: { owner: null } };
  }
  const game = {
    version: 6,
    mode,
    mapId: selectedMap?.id ?? null,
    boardSize: size,
    turnLimit: options.rounds,
    openingTilesPerPlayer: options.openingTilesPerPlayer,
    missionsEnabled: options.missionsEnabled,
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
    moves: UNIT_DEFINITIONS.worker.moves,
    acted: false,
    selectedUnitId: null,
    recruited: false,
    workerRecruitsUsed: 0,
    finished: false,
    log: [
      mode === "solo"
        ? "Votre royaume prend son essor."
        : sourceMessage("messages.lesDeuxKingdomsPrennentLeurEssor"),
    ],
  };
  initializeMissions(game, shuffle(Object.keys(MISSIONS), rng));
  return game;
}
// Shared draft before round one: J2, J1, J2, J1.
export function startOpening(g) {
  if (g.opening || g.round !== 1 || g.active !== 0 || g.players.some(p => p.revealed))
    throw Error(sourceMessage("messages.setupCanOnlyBeginBeforeTheGame"));
  const perPlayer = g.openingTilesPerPlayer ?? GAME_DEFAULTS.openingTilesPerPlayer,
    totalPlacements = perPlayer * g.players.length;
  if (!totalPlacements) {
    g.opening = null;
    note(g, sourceMessage("messages.noSetupTilesTheFirstTurnBegins"));
    return;
  }
  const offerCount = Math.max(5, totalPlacements + 1),
    indexes = g.tileDeck.map((tile, i) => tile.cells.length >= 5 ? i : -1)
      .filter(i => i >= 0).slice(0, offerCount);
  if (indexes.length < offerCount)
    throw Error(sourceMessage("messages.theDeckDoesNotContainLargeTiles", [offerCount]));
  const tiles = indexes.map(i => g.tileDeck[i]);
  for (const i of indexes.reverse()) g.tileDeck.splice(i, 1);
  g.opening = { tiles, step: 0, totalPlacements, perPlayer };
  g.active = g.players.length === 2 ? 1 : 0;
  note(g, sourceMessage("messages.setupTuileToPlacePerPlayer", [perPlayer, perPlayer === 1 ? "" : "s"]));
}
export function openingError(g, index, x, y, rotation = 0) {
  if (!g.opening) return sourceMessage("messages.setupIsComplete");
  if (g.finished) return sourceMessage("messages.theGameIsOver");
  if (!Number.isInteger(index) || !g.opening.tiles[index]) return sourceMessage("messages.chooseOneOfTheAvailableTiles");
  return tilePlacement(g, g.opening.tiles[index], x, y, rotation)
    ? null : sourceMessage("messages.thePatternMustFitOnEmptySpaces");
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
    note(g, sourceMessage("messages.setupCompleteTheFirstTurnBegins"));
  } else {
    g.active = g.players.length === 2 ? 1 - g.active : 0;
  }
  return cells;
}
export function score(g, i) {
  return {
    buildings: Object.entries(g.board).reduce((n,[k,c])=>{if(c.building?.owner!==i)return n;const b=BUILDINGS[c.building.type], [x,y]=parseKey(k);const multiplier=['monument','small_monument','large_monument'].includes(b.family||b.id) && nearbyBuildings(g,i,x,y).some(v=>BUILDINGS[v.building.type].monumentMultiplier)?2:1;return n+(b.points??RULES.points.building)*multiplier;},0),
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
  if (g.finished) throw Error(sourceMessage("messages.theGameIsOver"));
  if (g.opening) throw Error(sourceMessage("messages.finishTerrainSetupFirst"));
}
function note(g, text) {
  g.log.unshift(text);
  g.log = g.log.slice(0, 40);
}
export function actor(g) {
  const p = g.players[g.active];
  const unit = g.selectedUnitId !== null && g.selectedUnitId !== undefined
    ? p.units.find(u => u.id === g.selectedUnitId)
    : p.units.find(u => u.type === "worker");
  if (!unit) throw Error(sourceMessage("messages.unknownUnit"));
  return {
    ...unit,
    ...(unit.type === "soldier" ? { count: selectedSoldiers(g).length, moves: Math.min(...selectedSoldiers(g).map(u => u.moves)), acted: selectedSoldiers(g).some(u => u.acted || u.ended) } : {}),
    name: UNIT_DEFINITIONS[unit.type].name + " " + (unit.id + 1),
    icon: UNIT_DEFINITIONS[unit.type].icon,
  };
}
function updateActor(g, changes) {
  const unit = actor(g);
  if (unit.type === "soldier") {
    for (const soldier of selectedSoldiers(g)) Object.assign(soldier, changes);
  } else Object.assign(g.players[g.active].units.find(u => u.id === unit.id), changes);
}
export function selectUnit(g, id) {
  available(g);
  if (id !== null && !g.players[g.active].units.some((u) => u.id === id))
    throw Error(sourceMessage("messages.chooseOneOfYourUnits"));
  g.selectedUnitId = id;
  g.armySelection = null;
}
export function pawns(g, owner) {
  const p = g.players[owner];
  if (!p) return [];
  return p.units || [];
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
  if (lead?.type !== "soldier") throw Error(sourceMessage("messages.chooseAnArmy"));
  const ready = armyAt(g, g.active, lead.x, lead.y).filter(u => !u.acted && !u.ended)
    .sort((a,b) => b.moves-a.moves || a.id-b.id);
  if (!Number.isInteger(count) || count < 1 || count > ready.length) throw Error(sourceMessage("messages.invalidArmySize"));
  g.armySelection = ready.slice(0, count).map(u => u.id);
  g.selectedUnitId = g.armySelection[0];
}
function hostileSite(g, x, y) {
  const cell = g.board[key(x,y)];
  return Boolean((cell?.building && cell.building.owner !== g.active) ||
    (cell?.flag && cell.flag.owner !== g.active));
}
function siteBlocksMovement(g, x, y, unit) {
  if (unit.type !== "worker") return hostileSite(g, x, y);
  const building = g.board[key(x,y)]?.building;
  return Boolean(building && building.owner !== g.active && BUILDINGS[building.type]?.garrison);
}
export function defenseAt(g, owner, x, y) {
  const defenders = armyAt(g, owner, x, y).length;
  const building = g.board[key(x, y)]?.building;
  const garrison = building?.owner === owner ? BUILDINGS[building.type]?.garrison || 0 : 0;
  const bonus = defenders + garrison > 0 ? 1 + kingdomBonus(g,owner,"combatBonus") : 0;
  return { defenders, garrison, bonus, defense: defenders + garrison + bonus };
}
export function combatPreview(g, x, y) {
  const unit = actor(g), cell = g.board[key(x,y)];
  const owner = g.players.findIndex((_, i) => i !== g.active && pawns(g,i).some(u => u.x === x && u.y === y));
  const defenderOwner = cell?.building && cell.building.owner !== g.active ? cell.building.owner : owner;
  const { defenders, garrison, defense } = defenseAt(g, defenderOwner, x, y);
  const attack = unit.type === "soldier" ? selectedSoldiers(g).length + kingdomBonus(g,g.active,"combatBonus") : 0;
  return { attack, defense, defenders, garrison, attackerSurvivors: Math.min(selectedSoldiers(g).length, Math.max(0, attack-defense)),
    defenderSurvivors: Math.min(defenders + garrison, Math.max(0, defense-attack)), defenderOwner };
}
export function attackError(g, x, y) {
  if (g.finished) return sourceMessage("messages.theGameIsOver");
  if (g.opening) return sourceMessage("messages.finishTerrainSetupFirst");
  const unit = actor(g);
  if (unit.type !== "soldier") return sourceMessage("messages.onlyAnArmyCanFightOrCapture");
  if (unit.acted || unit.ended) return sourceMessage("messages.thisArmyHasAlreadyCompletedItsAction");
  if (!inside(g,x,y) || distance(unit,{x,y}) !== 1) return sourceMessage("messages.theTargetMustBeAdjacentNotDiagonal");
  const cell = g.board[key(x,y)];
  if (!cell || !unitWalkable(g,cell,x,y)) return sourceMessage("messages.thisTargetIsUnreachable");
  if (!hostileSite(g,x,y) && !enemyAt(g,x,y)) return sourceMessage("messages.thereIsNoEnemyTargetOrNeutral");
  return null;
}
export function destroyBuilding(g, x, y) {
  // Only the actual building cell is a military target, never an auxiliary tile.
  const position = key(x,y), cell = g.board[position], b = cell?.building;
  if (!b) return;
  delete cell.building;
  note(g, sourceMessage("messages.destroyed", [BUILDINGS[b.type].name]));
}
function returnBuilders(g, owner, x, y) {
  const p = g.players[owner];
  if (!p) return;
  for (const unit of p.units) {
    if (unit.type !== "worker" || unit.x !== x || unit.y !== y) continue;
    Object.assign(unit, p.home, { moves:0, acted:true, ended:true, skipTurns:0 });
    note(g, sourceMessage("messages.workerReturns", [p.name]));
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
  note(g, sourceMessage("messages.combatVersusSurvivingAttackerS", [result.attack, result.defense, survivors.length, g.victory === "conquest" ? sourceMessage("messages.keepConqueredImmediateVictory") : ""]));
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
      if (!inside(g,tx,ty) || !unitWalkable(g,g.board[k],tx,ty) || (!hostileSite(g,tx,ty) && !enemyAt(g,tx,ty))) continue;
      if (!paths.has(k)) paths.set(k,path);
    }
  }
  return paths;
}
export function moveError(g, x, y) {
  if (g.finished) return sourceMessage("messages.theGameIsOver");
  if (g.opening) return sourceMessage("messages.finishTerrainSetupFirst");
  const unit = actor(g);
  if (unit.moves < 1 || (unit.type === "soldier" && unit.acted) || unit.ended)
    return sourceMessage("messages.thisUnitHasFinishedMoving");
  if (!inside(g, x, y) || distance(unit, { x, y }) !== 1)
    return sourceMessage("messages.chooseAnAdjacentSpaceNotDiagonal");
  if (enemyAt(g, x, y)) return sourceMessage("messages.anEnemyPieceOccupiesThisSpaceUse");
  if (siteBlocksMovement(g, x, y, unit)) return sourceMessage("messages.thisPositionMustBeOccupiedUsingA");
  if (g.board[key(x, y)] && !unitWalkable(g,g.board[key(x, y)],x,y))
    return sourceMessage("messages.thisTerrainIsImpassable");
  return null;
}
export function move(g, x, y) {
  const error = moveError(g, x, y);
  if (error) throw Error(error);
  if (!g.board[key(x, y)]) {
    if (actor(g).type === "soldier") throw Error(sourceMessage("messages.soldiersCannotExplore"));
    return "explore";
  }
  if (actor(g).type === "soldier") {
    for (const soldier of selectedSoldiers(g)) Object.assign(soldier,{x,y,moves:soldier.moves-1});
  } else {
    updateActor(g, { x, y, moves: actor(g).moves - 1 });
    if (actor(g).type === "worker") {
      const cell = g.board[key(x, y)];
      if (cell.building) cell.building.owner = g.active;
      if (cell.flag) cell.flag.owner = g.active;
    }
  }
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
  if (g.finished) return sourceMessage("messages.theGameIsOver");
  if (g.opening) return sourceMessage("messages.finishTerrainSetupFirst");
  const unit = actor(g);
  if (unit.type === "soldier") return sourceMessage("messages.soldiersCannotExplore");
  if (unit.acted || unit.ended) return sourceMessage("messages.thisUnitHasAlreadyCompletedItsAction");
  if (g.board[key(x, y)]) return sourceMessage("messages.chooseAnUnexploredSpace");
  const cells = placement(g, index, x, y, rotation, anchor);
  if (!cells)
    return sourceMessage("messages.thePatternMustFitOnEmptySpaces");
  if (!cells.some((c) => distance(unit, c) === RULES.placement.explorationContactDistance))
    return sourceMessage("messages.oneSpaceOfTheTileMustBe", [RULES.placement.explorationContactDistance]);
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
  updateActor(g, { acted: true });
  if (g.tileDeck.length) g.tileMarket[index] = g.tileDeck.shift();
  else g.tileMarket.splice(index, 1);
  note(g, sourceMessage("messages.exploreSpaces", [p.name, cells.length]));
  awardMissions(g);
}
export function buyTerrainError(g, terrain, x, y) {
  if (g.finished) return sourceMessage("messages.theGameIsOver");
  if (g.opening) return sourceMessage("messages.finishTerrainSetupFirst");
  if (!["plain", "forest", "mountain", "river"].includes(terrain))
    return sourceMessage("messages.chooseAnAvailableTerrain");
  const unit = actor(g);
  if (unit.type === "soldier") return sourceMessage("messages.soldiersCannotExplore");
  if (unit.acted || unit.ended) return sourceMessage("messages.thisUnitHasAlreadyCompletedItsAction");
  if (!inside(g, x, y) || g.board[key(x, y)]) return sourceMessage("messages.chooseAnUnexploredSpace");
  if (!kingdomBonus(g,g.active,"remoteTerrain") && distance(unit, { x, y }) !== RULES.placement.explorationContactDistance)
    return sourceMessage("messages.theSpaceMustBeAdjacentToThe");
  if (g.players[g.active].resources.gold < (kingdomBonus(g,g.active,"remoteTerrain") ? 1 : RULES.trade.singleTerrainCost))
    return sourceMessage("messages.requiresGold", [(kingdomBonus(g,g.active,"remoteTerrain") ? 1 : RULES.trade.singleTerrainCost)]);
  return null;
}
export function buyTerrain(g, terrain, x, y) {
  const error = buyTerrainError(g, terrain, x, y);
  if (error) throw Error(error);
  const p = g.players[g.active];
  p.resources.gold -= (kingdomBonus(g,g.active,"remoteTerrain") ? 1 : RULES.trade.singleTerrainCost);
  g.board[key(x, y)] = { terrain };
  p.revealed++;
  p.progress.terrain[terrain] = (p.progress.terrain[terrain] || 0) + 1;
  updateActor(g, { acted: true });
  note(g, sourceMessage("messages.buysASpaceOfForGold", [p.name, TERRAINS[terrain].name.toLowerCase(), (kingdomBonus(g,g.active,"remoteTerrain") ? 1 : RULES.trade.singleTerrainCost)]));
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
  if (g.finished) return sourceMessage("messages.theGameIsOver");
  if (g.opening) return sourceMessage("messages.finishTerrainSetupFirst");
  if (unit.acted || unit.ended)
    return sourceMessage("messages.yourBuildingExplorationActionIsAlreadyComplete");
  if (unit.type === "soldier") return sourceMessage("messages.soldiersCannotBuild");
  if (!b) return sourceMessage("messages.chooseABuildingTile");
  if (b.unique && (p.units.some(u => u.type === b.onBuildUnit) || Object.values(g.board).some(c => c.building?.owner === g.active && c.building.type === type))) return sourceMessage("messages.onlyOneEmissaryAndOneChancelleryPer");
  if (b.constructible === false) return sourceMessage("messages.thisBuildingIsOnlyAvailableAtThe");
  if (!isRotation(rotation)) return sourceMessage("messages.invalidBuildingOrientation");
  const cells = patternAt(type, x, y, rotation);
  if (b.toll) {
    const target = g.board[key(x,y)];
    const bridge = target?.building?.owner === g.active &&
      ['bridge','great_bridge'].includes(target.building.type);
    if (target?.terrain === 'river' && !bridge) return `${b.name} : ${b.pattern}`;
  }
  for (const c of cells) {
    if (!inside(g, c.x, c.y)) return sourceMessage("messages.thePatternExtendsBeyondTheBoard");
    const target = g.board[key(c.x, c.y)];
    if (!target) return sourceMessage("messages.allSpacesInThePatternMustBe");
    if (c.symbol !== 'B') {
      if (!matchesTerrain(g,target,c.x,c.y,c.terrain)) return `${b.name} : ${b.pattern}`;
      if (c.symbol === 'c') {
        const neighbour = buildingAt(g,c.x,c.y)?.building;
        const definition = BUILDINGS[neighbour?.type];
        if (!definition || ['bridge','tunnel'].includes(definition.family || neighbour.type) || definition.greatBridge)
          return `${b.name} : ${b.pattern}`;
      }
      continue;
    }
    if (target.flag && type !== "outpost") return sourceMessage("messages.onlyATowerCanBeBuiltOn");
    if (target.building && !(b.toll && target.building.owner===g.active && ["bridge","great_bridge"].includes(target.building.type)))
      return sourceMessage("messages.thePatternOverlapsABuildingSpaceOr");
    if (!matchesTerrain(g,target,c.x,c.y,c.terrain))
      return sourceMessage("messages.incompatibleTerrainRequiresInsteadOf", [b.name, c.terrain.map(id => TERRAINS[id].name.toLowerCase()).join(sourceMessage("messages.or")), TERRAINS[target.terrain].name.toLowerCase(), b.pattern]);
    if (enemyAt(g, c.x, c.y)) return sourceMessage("messages.anEnemyPieceOccupiesThePattern");
  }
  if (!cells.some(cell => distance(unit, cell) <= RULES.placement.constructionRange))
    return sourceMessage("messages.placeTheTileWithinSpaceSOf", [RULES.placement.constructionRange]);
  if (b.adjacency?.some((rule) => !meetsAdjacency(g, rule, x, y, g.active)))
    return `${b.name} : ${b.pattern}`;
  if (
    !buildingPayment(g,index)?.affordable || (buildingPayment(g,index)?.gold > 0 && !allowGold)
  ) {
    const missing = Object.entries(b.cost).flatMap(([id, n]) => {
      const held = Number.isFinite(p.resources[id]) ? p.resources[id] : 0;
      return n > held ? [`${n - held} ${RESOURCES[id].toLowerCase()}`] : [];
    });
    return sourceMessage("messages.insufficientResourcesMissingNotEnoughGold", [missing.join(", ")]);
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
    throw Error(sourceMessage("messages.theGoldCostHasChangedPleaseConfirm"));
  if (
    payment?.gold &&
    (!allowGold || expectedGold !== payment.gold)
  )
    throw Error(sourceMessage("messages.confirmTheResourcePurchaseFromTheBank"));
  payCost(p.resources, payment.resources);

  if (b.transformTo) g.board[key(x, y)].terrain = b.transformTo;
  else {
    g.board[key(x, y)].building = { type, owner: g.active, rotation };
    if (type === "outpost" && g.board[key(x,y)].flag) g.board[key(x,y)].flag.owner = g.active;
    p.progress.built[type] = (p.progress.built[type] || 0) + 1;
  }
  if (b.grantsWorker) {
    for (let n = 0; n < b.grantsWorker; n++) addWorker(g, x, y);
  }
  if (b.onBuildUnit) spawnUnit(g, x, y, b.onBuildUnit);
  for (const [resource, amount] of Object.entries(b.onBuildGain || {}))
    p.resources[resource] += amount;
  updateActor(g, { acted: true });
  const replacement = drawBuildingOffers(g, 1);
  if (replacement.length) g.buildingMarket[index] = replacement[0];
  else g.buildingMarket.splice(index, 1);
  note(
    g,
    b.transformTo
      ? sourceMessage("messages.uses", [p.name, b.name.toLowerCase()])
      : sourceMessage("messages.builds", [p.name, b.name.toLowerCase()]),
  );
  awardMissions(g);
}
export function trainError(g, x, y, type) {
  if (g.finished) return sourceMessage("messages.theGameIsOver");
  if (g.opening) return sourceMessage("messages.finishTerrainSetupFirst");
  const b = g.board[key(x, y)]?.building,
    def = BUILDINGS[b?.type],
    unit = UNIT_DEFINITIONS[type];
  if (!b || b.owner !== g.active || !unit || ["king", "worker"].includes(type) || !def.trains?.includes(type))
    return sourceMessage("messages.chooseOneOfYourBarracksAndAn");
  if (b.trainingRound === g.round && (b.trainedCount || 0) >= trainingCapacity(g,x,y))
    return sourceMessage("messages.theseBarracksHaveAlreadyRecruitedThisTurn");
  if (enemyAt(g, x, y)) return sourceMessage("messages.anEnemyPieceOccupiesTheBarracks");
  if (!costPayment(g, unit.cost)?.affordable)
    return sourceMessage("messages.insufficientResourcesForThisUnit");
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
  note(g, sourceMessage("messages.recruits", [p.name, def.name.toLowerCase()]));
  awardMissions(g);
  return unit;
}
function addWorker(g, x, y) {
  const p = g.players[g.active];
  spawnUnit(g, x, y, "worker");
  p.workers++;
  p.progress.recruited++;
}
function spawnUnit(g, x, y, type) {
  const p = g.players[g.active];
  p.nextUnitId = Math.max(p.nextUnitId || 0, ...p.units.map(u => u.id + 1));
  const unit = { id: p.nextUnitId++, type, x, y, home: {x,y}, moves: 0, acted: true, ended: true, skipTurns: 0 };
  p.units.push(unit);
  return unit;
}
export function productionPreview(g, unit = actor(g), owner = g.active) {
  const cell = g.board[key(unit.x,unit.y)];
  const b = cell?.building, definition = BUILDINGS[b?.type];
  if (b) return b.owner === owner && definition?.produces
    ? { resource:definition.produces, amount:productionAmount(g,unit.x,unit.y), building:b } : null;
  if (cell?.flag) return null;
  const resource = ["plain","field"].includes(cell?.terrain) ? "food" : cell?.terrain === "forest" ? "material" : null;
  return resource ? {resource,amount:1} : null;
}
export function produceError(g) {
  if (g.finished) return sourceMessage("messages.theGameIsOver");
  if (g.opening) return sourceMessage("messages.finishTerrainSetupFirst");
  const unit = actor(g);
  if (unit.type !== "worker") return sourceMessage("messages.onlyWorkersProduce");
  if (unit.acted || unit.ended) return sourceMessage("messages.thisUnitHasAlreadyCompletedItsAction");
  const preview = productionPreview(g);
  if (!preview) return sourceMessage("messages.noProductionHere");
  if (preview.building?.productionRound === g.round) return sourceMessage("messages.productionUsed");
  return null;
}
export function produce(g) {
  const error = produceError(g);
  if (error) throw Error(error);
  grantProduction(g, actor(g), productionPreview(g));
}
function grantProduction(g, unit, preview) {
  const p = g.players[g.active];
  p.resources[preview.resource] += preview.amount;
  if (preview.building) preview.building.productionRound = g.round;
  Object.assign(p.units.find(u => u.id === unit.id), { acted:true });
  note(g,sourceMessage("messages.produces",[p.name,preview.amount,RESOURCES[preview.resource].toLowerCase()]));
  awardMissions(g);
}
// Forecast and settlement share the same worker order and building quota.
function automaticProductions(g, owner = g.active) {
  if (g.finished || g.opening) return [];
  const usedBuildings = new Set(), productions = [];
  const workers = g.players[owner].units.filter(u => u.type === "worker" && !u.acted && !u.ended)
    .sort((a,b) => a.id - b.id);
  for (const unit of workers) {
    const preview = productionPreview(g, unit, owner);
    if (!preview) continue;
    if (preview.building) {
      const position = key(unit.x,unit.y);
      if (preview.building.productionRound === g.round || usedBuildings.has(position)) continue;
      usedBuildings.add(position);
    }
    productions.push({ unit, preview });
  }
  return productions;
}
export function harvestPreview(g, owner = g.active) {
  const amounts = Object.fromEntries(Object.keys(RESOURCES).map(id => [id,0]));
  for (const { preview } of automaticProductions(g, owner)) amounts[preview.resource] += preview.amount;
  return { amounts, inactive:[] };
}
export function endTurn(g) {
  available(g);
  for (const { unit, preview } of automaticProductions(g)) grantProduction(g, unit, preview);
  awardMissions(g);
  const lastPlayer = g.active === g.players.length - 1;
  if (lastPlayer && g.round >= (g.turnLimit ?? RULES.rounds)) {
    g.finished = true;
    note(
      g,
      g.mode === "solo"
        ? sourceMessage("messages.theGameIsOverYourKingdomIs")
        : sourceMessage("messages.theGameIsOverTheKingdomsAre"),
    );
    return;
  }
  if (lastPlayer) g.round++;
  g.active = (g.active + 1) % g.players.length;
  g.selectedUnitId = null;
  g.armySelection = null;
  g.moves = UNIT_DEFINITIONS.worker.moves + kingdomBonus(g,g.active,"movementBonus");
  g.acted = false;
  g.recruited = false;
  g.workerRecruitsUsed = 0;
  g.rerollsUsed = 0;
  const next = g.players[g.active];
  if (next.kingSkip > 0) {
    next.kingSkip--;
    g.moves = 0; g.acted = true;
  }
  g.players[g.active].units.forEach((u) => {
    if (u.skipTurns > 0) {
      u.skipTurns--; u.moves = 0; u.acted = true; u.ended = true;
      return;
    }
    u.moves = UNIT_DEFINITIONS[u.type].moves + kingdomBonus(g,g.active,"movementBonus");
    u.acted = false;
    u.ended = false;
  });
}

// Reachable revealed cells and shortest paths for the selected unit.
export function movementPaths(g) {
  const unit = actor(g),
    paths = new Map();
  if (g.finished || g.opening || (unit.type === "soldier" && unit.acted) || unit.ended || unit.moves < 1) return paths;
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
        !unitWalkable(g,g.board[k],x,y) ||
        enemyAt(g, x, y) || siteBlocksMovement(g, x, y, unit)
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
      sourceMessage("messages.gold", [g.players[g.active].name, MISSIONS[id].name, MISSIONS[id].reward.gold]),
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
    sourceMessage("messages.rerollsTheMarketGold", [g.players[g.active].name, GOLD.rerollCost]),
  );
}
