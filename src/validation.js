import { parseKey } from "./geometry.js";
import { CONFIG } from "./configuration.js";
import {
  RULES,
  TERRAINS,
  BUILDINGS,
  UNIT_DEFINITIONS,
} from "./engine.js";
import { inside, key, isRotation } from "./geometry.js";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonnegative = (value) => Number.isSafeInteger(value) && value >= 0;
function requireValid(condition, message) {
  if (!condition) throw Error(`État de partie invalide : ${message}`);
}
function validateTiles(tiles) {
  requireValid(Array.isArray(tiles), "pioche de terrains absente.");
  for (const tile of tiles) {
    requireValid(
      Array.isArray(tile?.cells) && tile.cells.length > 0,
      "tuile vide.",
    );
    requireValid(
      tile.cells.every(
        (c) =>
          Number.isSafeInteger(c.x) &&
          Number.isSafeInteger(c.y) &&
          TERRAINS[c.terrain],
      ),
      "terrain de tuile incorrect.",
    );
    requireValid(
      new Set(tile.cells.map((c) => key(c.x, c.y))).size === tile.cells.length,
      "cases répétées dans une tuile.",
    );
    requireValid(
      tile.name === undefined || typeof tile.name === "string",
      "nom de tuile incorrect.",
    );
  }
}
export function validateGame(game, { legacy = false } = {}) {
  requireValid(
    record(game) && game.version === 5,
    "version inconnue.",
  );
  requireValid(
    game.boardSize === undefined || game.boardSize === RULES.size,
    "dimensions du plateau modifiées.",
  );
  requireValid(
    Array.isArray(game.players) &&
      (game.mode === "solo"
        ? game.players.length === 1
        : (game.mode === undefined || game.mode === "local") &&
          game.players.length === 2),
    "mode de jeu ou nombre de joueurs incorrect.",
  );
  requireValid(
    Number.isInteger(game.active) &&
      game.active >= 0 &&
      game.active < game.players.length &&
      Number.isSafeInteger(game.round) &&
      game.round >= 1 &&
      game.round <= RULES.rounds,
    "tour incorrect.",
  );
  requireValid(
    nonnegative(game.moves) &&
      game.moves <= UNIT_DEFINITIONS.king.moves &&
      ["acted", "recruited", "finished"].every(
        (k) => typeof game[k] === "boolean",
      ),
    "actions incorrectes.",
  );
  requireValid(
    Array.isArray(game.log) &&
      game.log.every((text) => typeof text === "string"),
    "chronique incorrecte.",
  );
  requireValid(record(game.board), "plateau absent.");
  requireValid(game.victory === undefined || (game.victory === "conquest" && game.finished &&
    Number.isInteger(game.winner) && game.players[game.winner]), "victoire incorrecte.");
  for (const [position, cell] of Object.entries(game.board)) {
    const [x, y] = parseKey(position);
    requireValid(
      inside(x, y, RULES.size) &&
        key(x, y) === position &&
        record(cell) &&
        TERRAINS[cell.terrain],
      "case incorrecte.",
    );
    if (cell.building) {
      const b = cell.building;
      requireValid(
        record(b) &&
          BUILDINGS[b.type] &&
          Number.isInteger(b.owner) &&
          b.owner >= 0 &&
          b.owner < game.players.length,
        "bâtiment inconnu.",
      );
      requireValid(
        b.rotation === undefined || isRotation(b.rotation),
        "orientation incorrecte.",
      );
      for (const field of ["trainingRound", "trainedCount"])
        requireValid(
          b[field] === undefined || nonnegative(b[field]),
          "quota de caserne incorrect.",
        );
    }
    if (cell.flag !== undefined)
      requireValid(record(cell.flag) && (cell.flag.owner === null ||
        Number.isInteger(cell.flag.owner) && Boolean(game.players[cell.flag.owner])), "drapeau incorrect.");
    if (cell.overlay)
      requireValid(
        record(cell.overlay) &&
          typeof cell.overlay.anchor === "string" &&
          typeof cell.overlay.role === "string" &&
          game.board[cell.overlay.anchor]?.building,
        "tuile bâtiment sans entrée.",
      );
  }
  for (const player of game.players) {
    requireValid(record(player.home) && inside(player.home.x,player.home.y,RULES.size) &&
      Boolean(game.board[key(player.home.x,player.home.y)]), "donjon d’origine incorrect.");
    requireValid(nonnegative(player.kingSkip) && player.kingSkip <= 1, "retour du roi incorrect.");
    requireValid(nonnegative(player.nextUnitId), "compteur d’unités incorrect.");
    requireValid(
      record(player) &&
        typeof player.name === "string" &&
        inside(player.x, player.y, RULES.size) &&
        game.board[key(player.x, player.y)],
      "position du roi incorrecte.",
    );
    requireValid(
      record(player.resources) &&
        Object.values(player.resources).every(nonnegative) &&
        nonnegative(player.workers) &&
        nonnegative(player.revealed),
      "ressources ou population incorrectes.",
    );
    if (!legacy || game.version === 5) {
      requireValid(
        Array.isArray(player.workerAssignments) &&
          player.workerAssignments.length === player.workers,
        "population d’ouvriers incohérente.",
      );
      const ids = new Set();
      for (const w of player.workerAssignments) {
        requireValid(
          nonnegative(w.id) &&
            !ids.has(w.id) &&
            (w.building === null || typeof w.building === "string"),
          "affectation incorrecte.",
        );
        ids.add(w.id);
      }
    }
    if (player.units !== undefined) {
      requireValid(Array.isArray(player.units), "liste d’unités incorrecte.");
      const ids = new Set();
      for (const unit of player.units) {
        requireValid(
          UNIT_DEFINITIONS[unit.type] &&
          !["king", "worker"].includes(unit.type) &&
            nonnegative(unit.id) &&
            !ids.has(unit.id) &&
            inside(unit.x, unit.y, RULES.size) &&
            game.board[key(unit.x, unit.y)] &&
            nonnegative(unit.moves) &&
            unit.moves <= UNIT_DEFINITIONS[unit.type].moves &&
            (unit.skipTurns === undefined || nonnegative(unit.skipTurns) && unit.skipTurns <= 1) &&
            typeof unit.acted === "boolean" &&
            (unit.ended === undefined || typeof unit.ended === "boolean"),
          "unité incorrecte.",
        );
        ids.add(unit.id);
      }
      requireValid(player.units.every(u=>u.id < player.nextUnitId), "compteur d’unités périmé.");
    }
  }
  requireValid(
    Array.isArray(game.tileMarket) &&
      game.tileMarket.length <= RULES.markets.terrainSize &&
      Array.isArray(game.buildingMarket) &&
      game.buildingMarket.length <= RULES.markets.buildingSize &&
      Array.isArray(game.buildingDeck) &&
      [...game.buildingMarket, ...game.buildingDeck].every(
        (id) => typeof id === "string",
      ),
    "marché incorrect.",
  );
  requireValid(
    game.buildingReplacements === undefined || nonnegative(game.buildingReplacements),
    "compteur de remplacements incorrect.",
  );
  if (game.missions !== undefined) {
    const missions = game.missions;
    requireValid(
      missions.tiered === undefined || missions.tiered === 1,
      "version des missions incorrecte.",
    );
    requireValid(
      record(missions) &&
        Array.isArray(missions.market) &&
        missions.market.length <= RULES.missionMarketSize &&
        Array.isArray(missions.deck) &&
        Array.isArray(missions.claimed),
      "missions incorrectes.",
    );
    if (missions.baselines !== undefined) {
      requireValid(record(missions.baselines), "progression initiale des missions incorrecte.");
      for (const [id, values] of Object.entries(missions.baselines))
        requireValid(missions.market.includes(id) && Array.isArray(values) &&
          values.length === game.players.length && values.every(nonnegative),
          "progression initiale des missions incorrecte.");
    }
    requireValid(
      missions.claimed.every(
        (c) =>
          record(c) &&
          Number.isInteger(c.owner) &&
          c.owner >= 0 &&
          c.owner < game.players.length &&
          nonnegative(c.round) &&
          c.round >= 1 &&
          c.round <= game.round,
      ),
      "mission attribuée incorrecte.",
    );
    const ids = [
      ...missions.market,
      ...missions.deck,
      ...missions.claimed.map((c) => c.id),
    ];
    requireValid(
      ids.every((id) => Object.hasOwn(CONFIG.missions, id)) &&
        new Set(ids).size === ids.length,
      "mission inconnue ou répétée.",
    );
  } else requireValid(legacy, "missions absentes.");
  requireValid(
    (legacy && game.rerollsUsed === undefined) || nonnegative(game.rerollsUsed),
    "quota de relance incorrect.",
  );
  requireValid(game.workerRecruitsUsed === undefined || nonnegative(game.workerRecruitsUsed), "quota de recrutement incorrect.");
  for (const p of game.players) {
    requireValid(nonnegative(p.resources.gold), "or incorrect.");
    if (p.progress !== undefined) {
      requireValid(
        record(p.progress) &&
          record(p.progress.terrain) &&
          record(p.progress.built) &&
          nonnegative(p.progress.recruited),
        "progression des missions incorrecte.",
      );
      for (const [field, defs] of [
        ["terrain", TERRAINS],
        ["built", BUILDINGS],
      ])
        requireValid(
          Object.entries(p.progress[field]).every(
            ([id, n]) => Object.hasOwn(defs, id) && nonnegative(n),
          ),
          "compteur de mission incorrect.",
        );
    } else requireValid(legacy, "progression absente.");
  }
  validateTiles([
    ...game.tileMarket,
    ...(Array.isArray(game.tileDeck) ? game.tileDeck : []),
  ]);
  requireValid(Array.isArray(game.tileDeck), "pioche de terrains absente.");
  return game;
}

