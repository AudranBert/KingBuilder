const forbidden = ["__proto__", "prototype", "constructor"];
// One fixed alphabet for every building pattern; c means an existing building.
const buildingTerrains = {
  p: ['plain'], f: ['forest'], m: ['mountain'], r: ['river'],
  w: ['field'], l: ['plain','forest'],
};
const fail = (path, message) => {
  throw new Error(`Configuration invalide : ${path} — ${message}`);
};
const object = (v, path) => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    fail(path, "objet attendu.");
};
const integer = (v, path, min = 0) => {
  if (!Number.isSafeInteger(v) || v < min)
    fail(path, `entier supérieur ou égal à ${min} attendu.`);
};
const label = (v, path) => {
  if (typeof v !== "string" || !v.trim()) fail(path, "texte non vide attendu.");
};
const identifier = (v, path) => {
  if (
    typeof v !== "string" ||
    !/^[a-z][a-z0-9_-]*$/.test(v) ||
    forbidden.includes(v)
  )
    fail(path, "identifiant unique en minuscules attendu.");
};
function index(items, path) {
  if (!Array.isArray(items) || !items.length)
    fail(path, "liste non vide attendue.");
  const result = {};
  for (const item of items) {
    object(item, path);
    identifier(item.id, `${path}.id`);
    if (Object.hasOwn(result, item.id))
      fail(path, `identifiant en double : ${item.id}.`);
    label(item.name, `${path}.${item.id}.name`);
    result[item.id] = item;
  }
  return result;
}
function connected(cells) {
  const visited = new Set([`${cells[0].x},${cells[0].y}`]),
    pending = [cells[0]];
  while (pending.length) {
    const c = pending.pop();
    for (const other of cells) {
      const k = `${other.x},${other.y}`;
      if (
        !visited.has(k) &&
        Math.abs(other.x - c.x) + Math.abs(other.y - c.y) === 1
      ) {
        visited.add(k);
        pending.push(other);
      }
    }
  }
  return visited.size === cells.length;
}
function diagram(rows, symbols, path, negation = false) {
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.some((r) => typeof r !== "string" || !r.length)
  )
    fail(path, "liste de lignes non vides attendue.");
  const cells = [];
  rows.forEach((row, y) =>
    (negation ? row.match(/!.|./gu) : [...row]).forEach((symbol, x) => {
      if (symbol === ".") return;
      if (!symbols.includes(symbol)) fail(path, `symbole inconnu : ${symbol}.`);
      cells.push({ x, y, symbol });
    }),
  );
  if (!cells.length)
    fail(path, "une tuile doit contenir au moins une case occupée.");
  if (!negation && !connected(cells))
    fail(path, "toutes les cases doivent être reliées par un bord.");
  return cells;
}
function costs(value, resources, path) {
  object(value, path);
  for (const [id, n] of Object.entries(value)) {
    if (!Object.hasOwn(resources, id))
      fail(path, `ressource inconnue : ${id}.`);
    if (resources[id].calculated)
      fail(path, `une ressource calculée ne peut pas être dépensée : ${id}.`);
    integer(n, `${path}.${id}`);
  }
}
function weighted(items, path, deckSize) {
  integer(deckSize, `${path}.deckSize`, 1);
  const pool = [];
  for (const [id, item] of Object.entries(items)) {
    integer(item.weight, `${path}.${id}.weight`, 1);
    if (item.weight > deckSize)
      fail(path, "un poids ne peut pas dépasser la taille de la pioche.");
    for (let i = 0; i < item.weight; i++) pool.push(id);
  }
  if (pool.length > deckSize)
    fail(
      path,
      "la pioche doit être assez grande pour contenir les poids de toutes les entrées.",
    );
  return pool;
}
function range(v, path) {
  if (!["edge", "touching", "radius2"].includes(v))
    fail(path, "utilisez edge (bords) ou touching (bords et coins).");
}
export function compileConfiguration(
  tileConfig,
  buildingConfig,
  resourceConfig,
  unitConfig,
  gameConfig,
  terrainConfig,
  missionConfig,
) {
  object(terrainConfig, "terrains.json");
  terrainConfig = structuredClone(terrainConfig);
  const terrainDefinitions = index(
      terrainConfig.terrains,
      "terrains.json.terrains",
    ),
    terrainIds = Object.keys(terrainDefinitions);
  for (const terrain of Object.values(terrainDefinitions)) {
    label(terrain.icon, `terrains.json.${terrain.id}.icon`);
    if (typeof terrain.walkable !== "boolean")
      fail(`terrains.json.${terrain.id}.walkable`, "booléen attendu.");
    for (const field of ["color", "foreground"])
      if (
        typeof terrain[field] !== "string" ||
        !/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(terrain[field])
      )
        fail(
          `terrains.json.${terrain.id}.${field}`,
          "couleur hexadécimale attendue, par exemple #668c68.",
        );
  }
  const terrainList = (list, path) => {
    if (
      !Array.isArray(list) ||
      !list.length ||
      list.some((id) => !Object.hasOwn(terrainDefinitions, id))
    )
      fail(path, `liste de terrains attendue (${terrainIds.join(", ")}).`);
  };
  object(gameConfig, "game-rules.json");
  gameConfig = structuredClone(gameConfig);
  integer(gameConfig.boardSize, "game-rules.json.boardSize", 3);
  integer(gameConfig.turnLimit, "game-rules.json.turnLimit", 1);
  object(gameConfig.trade, "game-rules.json.trade");
  integer(gameConfig.trade.basePrice, "game-rules.json.trade.basePrice", 1);
  integer(gameConfig.trade.producerSurcharge, "game-rules.json.trade.producerSurcharge");
  integer(gameConfig.trade.singleTerrainCost, "game-rules.json.trade.singleTerrainCost", 1);
  if (!Array.isArray(gameConfig.flags) || gameConfig.flags.length !== 5)
    fail("game-rules.json.flags", "cinq drapeaux attendus.");
  const flagPositions = new Set();
  for (const flag of gameConfig.flags) {
    for (const axis of ["x", "y"]) {
      integer(flag[axis], `game-rules.json.flags.${axis}`);
      if (flag[axis] >= gameConfig.boardSize) fail("game-rules.json.flags", "drapeau hors plateau.");
    }
    const position = `${flag.x},${flag.y}`;
    if (flagPositions.has(position)) fail("game-rules.json.flags", "drapeau répété.");
    flagPositions.add(position);
  }
  object(gameConfig.scoring, "game-rules.json.scoring");
  for (const name of ["building", "flag"])
    integer(gameConfig.scoring[name], `game-rules.json.scoring.${name}`);
  integer(gameConfig.scoring.goldPerPoint, "game-rules.json.scoring.goldPerPoint", 1);
  integer(gameConfig.scoring.flag, "game-rules.json.scoring.flag");
  integer(gameConfig.startingWorkers, "game-rules.json.startingWorkers");
  object(gameConfig.markets, "game-rules.json.markets");
  for (const field of ["terrainSize", "buildingSize", "advancedFromReplacement"])
    integer(gameConfig.markets[field], `game-rules.json.markets.${field}`, 1);
  integer(gameConfig.markets.initialMaxTier, "game-rules.json.markets.initialMaxTier");
  object(gameConfig.placement, "game-rules.json.placement");
  integer(gameConfig.placement.constructionRange, "game-rules.json.placement.constructionRange");
  integer(gameConfig.placement.explorationContactDistance, "game-rules.json.placement.explorationContactDistance", 1);
  if (!Array.isArray(gameConfig.players) || gameConfig.players.length !== 2)
    fail("game-rules.json.players", "deux royaumes attendus pour le mode local.");
  for (const player of gameConfig.players) {
    label(player.name, "game-rules.json.players.name");
    object(player.start, "game-rules.json.players.start");
    for (const axis of ["x", "y"])
      if (!Number.isFinite(player.start[axis]) || player.start[axis] < 0 || player.start[axis] > 1)
        fail("game-rules.json.players.start", "coordonnées relatives entre 0 et 1 attendues.");
  }
  object(gameConfig.gold, "game-rules.json.gold");
  for (const field of [
    "startingAmount",
    "firstPlayerStartingAmount",
    "rerollCost",
    "rerollLimitPerTurn",
  ])
    integer(
      gameConfig.gold[field],
      `game-rules.json.gold.${field}`,
      field.endsWith("StartingAmount") || field === "startingAmount" ? 0 : 1,
    );
  object(tileConfig, "terrain-tiles");
  object(buildingConfig, "buildings");
  object(resourceConfig, "resources.json");
  object(unitConfig, "units.json");
  if (Object.hasOwn(buildingConfig, "units"))
    fail(
      "buildings.units",
      "les unités doivent être définies uniquement dans units.json.",
    );
  tileConfig = structuredClone(tileConfig);
  buildingConfig = structuredClone(buildingConfig);
  resourceConfig = structuredClone(resourceConfig);
  unitConfig = structuredClone(unitConfig);
  const resources = index(resourceConfig.resources, "resources.json.resources");
  for (const r of Object.values(resources)) {
    label(r.icon, `resources.${r.id}.icon`);
    integer(r.startingAmount, `resources.${r.id}.startingAmount`);
    integer(r.points, `resources.${r.id}.points`);
    if (r.calculated !== undefined && r.calculated !== "population")
      fail(`resources.${r.id}.calculated`, "seule la valeur population est prise en charge.");
  }
  if (Object.hasOwn(resourceConfig, "recruitmentCost"))
    fail(
      "resources.json.recruitmentCost",
      "le coût de recrutement doit être défini uniquement dans units.json.units.worker.cost.",
    );
  if (!Array.isArray(unitConfig.units))
    fail("units.json.units", "liste attendue.");
  const units = unitConfig.units.length
    ? index(unitConfig.units, "units.json.units")
    : {};
  for (const id of ["worker"])
    if (!units[id]) fail(`units.json.units.${id}`, "définition obligatoire.");
  for (const unit of Object.values(units)) {
    const path = `units.json.units.${unit.id}`;
    label(unit.icon, `${path}.icon`);
    costs(unit.cost, resources, `${path}.cost`);
    integer(unit.moves, `${path}.moves`, 1);
    const expected = unit.id === "king" ? "initial" : unit.id === "worker" ? "house" : "building";
    if (unit.recruitment !== expected)
      fail(`${path}.recruitment`, `utilisez ${expected} pour cette unité.`);
    if (unit.recruitment === "initial" && Object.keys(unit.cost).length)
      fail(`${path}.cost`, "une unité fournie au départ doit avoir un coût vide.");
  }
  const shapes = index(tileConfig.shapes, "terrain-tiles.shapes");
  for (const shape of Object.values(shapes))
    shape.cells = diagram(
      shape.pattern,
      ["x"],
      `terrain-tiles.${shape.id}.pattern`,
    ).map(({ x, y }) => ({ x, y }));
  integer(tileConfig.deckSize, "terrain-tiles/index.json.deckSize", 1);
  for (const shape of Object.values(shapes))
    integer(shape.weight, `terrain-tiles.${shape.id}.weight`, 1);
  object(tileConfig.legend, "terrain-tiles/index.json.legend");
  for (const [symbol, terrain] of Object.entries(tileConfig.legend)) {
    if (symbol.length !== 1 || symbol === ".")
      fail(
        "terrain-tiles/index.json.legend",
        "symboles d’une lettre, hors point, attendus.",
      );
    if (!terrainDefinitions[terrain])
      fail("terrain-tiles/index.json.legend", `terrain inconnu : ${terrain}.`);
  }
  const tiles = Object.values(
    index(tileConfig.tiles, "terrain-tiles.tiles"),
  );
  if (tiles.length !== tileConfig.deckSize)
    fail(
      "terrain-tiles/index.json.deckSize",
      "la taille de pioche doit correspondre au nombre de tuiles définies.",
    );
  for (const tile of tiles) {
    const path = `terrain-tiles.tiles.${tile.id}`;
    const shape = shapes[tile.shapeId];
    if (!shape) fail(path, "forme inconnue.");
    const cells = diagram(
      tile.pattern,
      Object.keys(tileConfig.legend),
      `${path}.pattern`,
    );
    const positions = (list) =>
      list
        .map((c) => `${c.x},${c.y}`)
        .sort()
        .join(";");
    if (positions(cells) !== positions(shape.cells))
      fail(path, "le motif doit respecter les cases et les vides de la forme.");
    tile.cells = cells.map((c) => ({
      x: c.x,
      y: c.y,
      terrain: tileConfig.legend[c.symbol],
    }));
    if (tile.intent !== undefined) label(tile.intent, `${path}.intent`);
  }
  const buildings = index(buildingConfig.buildings, "buildings/*.json");
  for (const b of Object.values(buildings)) {
    const path = `buildings.${b.id}`;
    for (const field of ["points", "garrison", "grantsWorker", "tradeDiscount", "buildingDiscount", "movementBonus", "combatBonus", "trainingBoost", "monumentMultiplier"])
      if (b[field] !== undefined) integer(b[field], `${path}.${field}`);
    for (const field of ["waterMovement", "remoteTerrain", "portBonus", "toll", "greatBridge", "createsFields"])
      if (b[field] !== undefined && typeof b[field] !== 'boolean') fail(path, `${field} doit être un booléen.`);
    if (b.unique !== undefined && typeof b.unique !== "boolean") fail(path, "unique doit être un booléen.");
    if (b.onBuildUnit !== undefined && !units[b.onBuildUnit]) fail(path, "unité initiale inconnue.");
    label(b.icon, `${path}.icon`);
    label(b.description, `${path}.description`);
    label(b.pattern, `${path}.pattern`);
    if (typeof b.terrain === 'string') b.terrain = [b.terrain];
    terrainList(b.terrain, `${path}.terrain`);
    costs(b.cost, resources, `${path}.cost`);
    b.tier ??= 1;
    integer(b.tier, `${path}.tier`, 0);
    if (b.constructible !== undefined && typeof b.constructible !== "boolean")
      fail(path, "constructible doit être un booléen.");
    if (b.onBuildGain !== undefined)
      costs(b.onBuildGain, resources, `${path}.onBuildGain`);
    if (b.legend !== undefined || b.adjacency !== undefined)
      fail(path, "utilisez les symboles fixes du layout, sans legend ni adjacency.");
    if (Array.isArray(b.layout))
      b.layout = b.layout.map(row => typeof row === 'string' ? row.replaceAll('b','B') : row);
    const cells = diagram(
        b.layout,
        ['B','c',...Object.keys(buildingTerrains),
          ...Object.keys(buildingTerrains).filter(s => buildingTerrains[s].length === 1).map(s => `!${s}`)],
        `${path}.layout`,
        true,
      ),
      anchors = cells.filter((c) => c.symbol === "B");
    if (anchors.length !== 1)
      fail(path, "le motif doit contenir exactement une case bâtiment B.");
    const origin = anchors[0];
    b.cells = cells.map((c) => ({
      x: c.x - origin.x,
      y: c.y - origin.y,
      symbol: c.symbol,
      terrain: c.symbol === 'B' ? b.terrain
        : c.symbol === 'c' ? terrainIds
        : c.symbol.startsWith('!') ? terrainIds.filter(id => id !== buildingTerrains[c.symbol.slice(1)][0])
        : buildingTerrains[c.symbol],
      ...(c.symbol.startsWith('!') ? {excludedTerrain:buildingTerrains[c.symbol.slice(1)][0]} : {}),
    }));
    if (b.produces !== undefined) {
      if (!Object.hasOwn(resources, b.produces))
        fail(path, `ressource produite inconnue : ${b.produces}.`);
      integer(b.production, `${path}.production`, 1);
      if (b.productionFamily !== undefined &&
          (!buildings[b.productionFamily]?.produces || buildings[b.productionFamily].produces !== b.produces))
        fail(path, "productionFamily doit viser un producteur de la même ressource.");
    } else if (b.production !== undefined)
      fail(path, "production exige une ressource produces.");
    if (b.trains !== undefined) {
      if (
        !Array.isArray(b.trains) ||
        !b.trains.length ||
        b.trains.some((id) => !Object.hasOwn(units, id) || ["king", "worker"].includes(id))
      )
        fail(path, "trains doit référencer des unités connues, hors roi et ouvrier.");
      integer(b.trainingLimit, `${path}.trainingLimit`, 1);
    }
    if (b.traversable !== undefined && typeof b.traversable !== "boolean")
      fail(path, "traversable doit être un booléen.");
    if (b.adjacentOn !== undefined)
      terrainList(b.adjacentOn, `${path}.adjacentOn`);
    if (
      b.transformTo !== undefined &&
      (!terrainIds.includes(b.transformTo) ||
        b.produces ||
        b.boost ||
        b.trains ||
        cells.length !== 1)
    )
      fail(
        path,
        "transformTo exige un terrain connu et une action d’une case, sans production, logement ni bonus.",
      );
    if (b.boost) {
      object(b.boost, path);
      if (!buildings[b.boost.target]?.produces)
        fail(path, "boost.target doit viser un bâtiment de production.");
      integer(b.boost.bonus, `${path}.boost.bonus`, 1);
      range(b.boost.range, path);
      if (typeof b.boost.owned !== "boolean")
        fail(path, "boost.owned doit être un booléen.");
    }
  }
  const buildingPool = weighted(
    Object.fromEntries(Object.entries(buildings).filter(([, b]) => b.constructible !== false)),
    "buildings",
    buildingConfig.deckSize,
  );
  if (!buildingPool.length) fail("buildings", "la pioche doit contenir un bâtiment constructible.");
  if (new Set(buildingPool.filter(id => buildings[id].tier === gameConfig.markets.initialMaxTier)
    .map(id => buildings[id].family || id)).size < gameConfig.markets.buildingSize)
    fail("buildings", "pas assez de familles différentes du niveau initial.");
  if (tileConfig.deckSize < gameConfig.markets.terrainSize)
    fail("game-rules.json.markets.terrainSize", "le marché dépasse la pioche.");
  for (const b of Object.values(buildings)) {
    if (b.family !== undefined && (!buildings[b.family] || buildings[b.family].family))
      fail(`buildings.${b.id}.family`, "référencez un bâtiment de base connu.");
  }
  if (buildingConfig.maxFamilyCopies !== undefined) {
    integer(buildingConfig.maxFamilyCopies, "buildings/index.json.maxFamilyCopies", 1);
    const counts = {};
    for (let i = 0; i < buildingConfig.deckSize; i++) {
      const id = buildingPool[i % buildingPool.length];
      const family = buildings[id].family || id;
      counts[family] = (counts[family] || 0) + 1;
      if (counts[family] > buildingConfig.maxFamilyCopies)
        fail(`buildings.${family}`, "la famille dépasse maxFamilyCopies, variantes comprises.");
    }
  }
  if (!buildings[buildingConfig.startingBuilding]?.garrison)
    fail(
      "buildings/index.json.startingBuilding",
      "choisissez un bâtiment doté d’une garnison.",
    );
  const start = buildings[buildingConfig.startingBuilding];
  if (
    !start.terrain.some((id) => terrainDefinitions[id].walkable) &&
    !start.traversable
  )
    fail(
      "buildings/index.json.startingBuilding",
      "le terrain du bâtiment de départ doit être praticable par un ouvrier.",
    );
  object(missionConfig, "missions");
  integer(missionConfig.marketSize, "missions/index.json.marketSize", 1);
  integer(missionConfig.initialDifficulty, "missions/index.json.initialDifficulty", 1);
  integer(missionConfig.maxDifficulty, "missions/index.json.maxDifficulty", missionConfig.initialDifficulty);
  integer(missionConfig.requiredContribution, "missions/index.json.requiredContribution");
  const missions = index(
    structuredClone(missionConfig.missions),
    "missions/*.json",
  );
  if (Object.values(missions).filter(m => m.difficulty === missionConfig.initialDifficulty).length < missionConfig.marketSize)
    fail("missions/*.json", "pas assez de missions du niveau initial.");
  for (const m of Object.values(missions)) {
    const path = `missions.${m.id}`;
    if (!["revealed", "built", "built-distinct", "produced", "multipliers", "military", "conquests", "landscaping"].includes(m.metric))
      fail(path, "objectif inconnu.");
    identifier(m.family, `${path}.family`);
    integer(m.difficulty, `${path}.difficulty`, 1);
    if (m.difficulty > missionConfig.maxDifficulty)
      fail(path, "la difficulté dépasse maxDifficulty.");
    integer(m.target, `${path}.target`, 1);
    object(m.reward, `${path}.reward`);
    if (!Object.keys(m.reward).length) fail(path, "récompense vide.");
    for (const [type, amount] of Object.entries(m.reward)) {
      if (!["gold", "material", "food", "soldiers", "score"].includes(type))
        fail(path, "récompense inconnue.");
      integer(amount, `${path}.reward.${type}`, 1);
    }
    for (const [field, metric, definitions] of [
      ["terrain", "revealed", terrainDefinitions],
      ["building", "built", buildings],
      ["resource", "produced", resources],
      ["producerResource", "built", resources],
    ])
      if (
        m[field] !== undefined &&
        (m.metric !== metric || !Object.hasOwn(definitions, m[field]))
      )
        fail(path, `${field} inconnu ou incompatible avec l’objectif.`);
  }
  const families = new Map();
  for (const m of Object.values(missions)) {
    if (!families.has(m.family)) families.set(m.family, []);
    families.get(m.family).push(m);
  }
  for (const [family, variants] of families) {
    variants.sort((a, b) => a.difficulty - b.difficulty);
    if (
      variants.length !== missionConfig.maxDifficulty ||
      variants.some((m, i) => m.difficulty !== i + 1)
    )
      fail(
        `missions.${family}`,
        "chaque objectif doit avoir une version par niveau jusqu’à maxDifficulty.",
      );
    const objective = (m) =>
      JSON.stringify([m.metric, m.terrain, m.building, m.resource, m.producerResource]);
    if (variants.some((m) => objective(m) !== objective(variants[0])))
      fail(
        `missions.${family}`,
        "les niveaux doivent concerner le même objectif.",
      );
    if (
      variants.some((m, i) => i > 0 && m.target <= variants[i - 1].target)
    )
      fail(
        `missions.${family}`,
        "les seuils doivent augmenter avec la difficulté.",
      );
  }
  if ([...families.values()].length < missionConfig.marketSize)
    fail(
      "missions/*.json",
      "pas assez d’objectifs distincts pour le marché.",
    );
  return {
    missions,
    missionRules: { initialDifficulty: missionConfig.initialDifficulty, maxDifficulty: missionConfig.maxDifficulty, requiredContribution: missionConfig.requiredContribution },
    missionMarketSize: missionConfig.marketSize,
    rules: gameConfig,
    terrains: terrainDefinitions,
    tiles,
    resources,
    buildings,
    units,
    shapes,
    buildingPool,
    tileDeckSize: tileConfig.deckSize,
    buildingDeckSize: buildingConfig.deckSize,
    startingBuilding: buildingConfig.startingBuilding,
  };
}
