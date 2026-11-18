const forbidden = ["__proto__", "prototype", "constructor"];
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
function diagram(rows, symbols, path) {
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.some((r) => typeof r !== "string" || !r.length)
  )
    fail(path, "liste de lignes non vides attendue.");
  const cells = [];
  rows.forEach((row, y) =>
    [...row].forEach((symbol, x) => {
      if (symbol === ".") return;
      if (!symbols.includes(symbol)) fail(path, `symbole inconnu : ${symbol}.`);
      cells.push({ x, y, symbol });
    }),
  );
  if (!cells.length)
    fail(path, "une tuile doit contenir au moins une case occupée.");
  if (!connected(cells))
    fail(path, "toutes les cases doivent être reliées par un bord.");
  return cells;
}
function costs(value, resources, path) {
  object(value, path);
  for (const [id, n] of Object.entries(value)) {
    if (!Object.hasOwn(resources, id))
      fail(path, `ressource inconnue : ${id}.`);
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
  if (!["edge", "touching"].includes(v))
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
  object(gameConfig.scoring, "game-rules.json.scoring");
  for (const name of ["tile", "building", "worker", "unit", "resource"])
    integer(gameConfig.scoring[name], `game-rules.json.scoring.${name}`);
  gameConfig.scoring.prestige ??= 3;
  integer(gameConfig.scoring.prestige, "game-rules.json.scoring.prestige");
  gameConfig.prestige ??= {
    startingAmount: 1,
    firstPlayerStartingAmount: 0,
    rerollCost: 1,
    rerollLimitPerTurn: 1,
    wildcardCost: 1,
  };
  object(gameConfig.prestige, "game-rules.json.prestige");
  gameConfig.prestige.firstPlayerStartingAmount ??= 0;
  for (const field of [
    "startingAmount",
    "firstPlayerStartingAmount",
    "rerollCost",
    "rerollLimitPerTurn",
    "wildcardCost",
  ])
    integer(
      gameConfig.prestige[field],
      `game-rules.json.prestige.${field}`,
      field.endsWith("StartingAmount") || field === "startingAmount" ? 0 : 1,
    );
  object(tileConfig, "terrain-tiles.json");
  object(buildingConfig, "buildings.json");
  object(resourceConfig, "resources.json");
  object(unitConfig, "units.json");
  if (Object.hasOwn(buildingConfig, "units"))
    fail(
      "buildings.json.units",
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
  }
  costs(
    resourceConfig.recruitmentCost,
    resources,
    "resources.json.recruitmentCost",
  );
  if (!Object.values(resourceConfig.recruitmentCost).some((n) => n > 0))
    fail(
      "resources.json.recruitmentCost",
      "au moins un coût positif est requis.",
    );
  if (!Array.isArray(unitConfig.units))
    fail("units.json.units", "liste attendue.");
  const units = unitConfig.units.length
    ? index(unitConfig.units, "units.json.units")
    : {};
  for (const unit of Object.values(units)) {
    const path = `units.json.units.${unit.id}`;
    label(unit.icon, `${path}.icon`);
    costs(unit.cost, resources, `${path}.cost`);
    integer(unit.moves, `${path}.moves`, 1);
    integer(unit.population, `${path}.population`, 1);
    integer(unit.points, `${path}.points`);
  }
  const shapes = index(tileConfig.shapes, "terrain-tiles.json.shapes");
  for (const shape of Object.values(shapes))
    shape.cells = diagram(
      shape.pattern,
      ["x"],
      `terrain-tiles.json.${shape.id}.pattern`,
    ).map(({ x, y }) => ({ x, y }));
  integer(tileConfig.deckSize, "terrain-tiles.json.deckSize", 1);
  for (const shape of Object.values(shapes))
    integer(shape.weight, `terrain-tiles.json.${shape.id}.weight`, 1);
  object(tileConfig.legend, "terrain-tiles.json.legend");
  for (const [symbol, terrain] of Object.entries(tileConfig.legend)) {
    if (symbol.length !== 1 || symbol === ".")
      fail(
        "terrain-tiles.json.legend",
        "symboles d’une lettre, hors point, attendus.",
      );
    if (!terrainDefinitions[terrain])
      fail("terrain-tiles.json.legend", `terrain inconnu : ${terrain}.`);
  }
  const tiles = Object.values(
    index(tileConfig.tiles, "terrain-tiles.json.tiles"),
  );
  if (tiles.length !== tileConfig.deckSize)
    fail(
      "terrain-tiles.json.deckSize",
      "la taille de pioche doit correspondre au nombre de tuiles définies.",
    );
  for (const tile of tiles) {
    const path = `terrain-tiles.json.tiles.${tile.id}`;
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
  const buildings = index(buildingConfig.buildings, "buildings.json.buildings");
  for (const b of Object.values(buildings)) {
    const path = `buildings.json.${b.id}`;
    label(b.icon, `${path}.icon`);
    label(b.description, `${path}.description`);
    label(b.pattern, `${path}.pattern`);
    terrainList(b.terrain, `${path}.terrain`);
    costs(b.cost, resources, `${path}.cost`);
    b.tier ??= 1;
    integer(b.tier, `${path}.tier`, 0);
    if (b.tier > 2) fail(`${path}.tier`, "utilisez un tier de 0 à 2.");
    if (b.constructible !== undefined && typeof b.constructible !== "boolean")
      fail(path, "constructible doit être un booléen.");
    if (b.onBuildGain !== undefined)
      costs(b.onBuildGain, resources, `${path}.onBuildGain`);
    object(b.legend, `${path}.legend`);
    for (const [symbol, part] of Object.entries(b.legend)) {
      if ([...symbol].length !== 1 || [".", "B"].includes(symbol))
        fail(
          path,
          "chaque symbole de légende doit être un caractère différent de B et du point.",
        );
      object(part, path);
      terrainList(part.terrain, `${path}.legend.${symbol}.terrain`);
      identifier(part.role, `${path}.legend.${symbol}.role`);
      if (part.role === "building")
        fail(path, "le rôle building est réservé à B.");
    }
    const cells = diagram(
        b.layout,
        ["B", ...Object.keys(b.legend)],
        `${path}.layout`,
      ),
      anchors = cells.filter((c) => c.symbol === "B");
    if (anchors.length !== 1)
      fail(path, "le motif doit contenir exactement une entrée B.");
    const origin = anchors[0];
    b.cells = cells.map((c) => ({
      x: c.x - origin.x,
      y: c.y - origin.y,
      ...(c.symbol === "B"
        ? { terrain: b.terrain, role: "building" }
        : b.legend[c.symbol]),
    }));
    if (b.produces !== undefined) {
      if (!Object.hasOwn(resources, b.produces))
        fail(path, `ressource produite inconnue : ${b.produces}.`);
      integer(b.production, `${path}.production`, 1);
    } else if (b.production !== undefined)
      fail(path, "production exige une ressource produces.");
    if (b.trains !== undefined) {
      if (
        !Array.isArray(b.trains) ||
        !b.trains.length ||
        b.trains.some((id) => !Object.hasOwn(units, id))
      )
        fail(path, "trains doit référencer des unités connues.");
      integer(b.trainingLimit, `${path}.trainingLimit`, 1);
    }
    if (b.housing !== undefined) integer(b.housing, `${path}.housing`, 1);
    if (b.traversable !== undefined && typeof b.traversable !== "boolean")
      fail(path, "traversable doit être un booléen.");
    if (b.adjacentOn !== undefined)
      terrainList(b.adjacentOn, `${path}.adjacentOn`);
    if (
      b.transformTo !== undefined &&
      (!terrainIds.includes(b.transformTo) ||
        b.produces ||
        b.housing ||
        b.boost ||
        b.trains ||
        cells.length !== 1)
    )
      fail(
        path,
        "transformTo exige un terrain connu et une action d’une case, sans production, logement ni bonus.",
      );
    if (b.adjacency !== undefined) {
      if (!Array.isArray(b.adjacency))
        fail(path, "adjacency doit être une liste.");
      for (const rule of b.adjacency) {
        object(rule, path);
        range(rule.range, path);
        if (typeof rule.owned !== "boolean")
          fail(path, "owned doit être un booléen.");
        if (Boolean(rule.building) === Boolean(rule.role))
          fail(path, "une condition doit viser soit building, soit role.");
        if (rule.building && !Object.hasOwn(buildings, rule.building))
          fail(path, `bâtiment voisin inconnu : ${rule.building}.`);
        if (rule.role) identifier(rule.role, path);
      }
    }
    if (b.boost) {
      object(b.boost, path);
      if (!buildings[b.boost.target]?.produces)
        fail(path, "boost.target doit viser un bâtiment de production.");
      integer(b.boost.multiplier, `${path}.boost.multiplier`, 2);
      range(b.boost.range, path);
      if (typeof b.boost.owned !== "boolean")
        fail(path, "boost.owned doit être un booléen.");
    }
  }
  const buildingPool = weighted(
    Object.fromEntries(Object.entries(buildings).filter(([, b]) => b.constructible !== false)),
    "buildings.json",
    buildingConfig.deckSize,
  );
  if (!buildingPool.length) fail("buildings.json", "la pioche doit contenir un bâtiment constructible.");
  if (Array.from({ length: buildingConfig.deckSize }, (_, i) =>
    buildingPool[i % buildingPool.length]).filter(id => buildings[id].tier < 2).length < 3)
    fail("buildings.json", "le marché initial exige trois bâtiments de tier 0 ou 1.");
  for (const b of Object.values(buildings)) {
    if (b.family !== undefined && (!buildings[b.family] || buildings[b.family].family))
      fail(`buildings.json.${b.id}.family`, "référencez un bâtiment de base connu.");
  }
  if (buildingConfig.maxFamilyCopies !== undefined) {
    integer(buildingConfig.maxFamilyCopies, "buildings.json.maxFamilyCopies", 1);
    const counts = {};
    for (let i = 0; i < buildingConfig.deckSize; i++) {
      const id = buildingPool[i % buildingPool.length];
      const family = buildings[id].family || id;
      counts[family] = (counts[family] || 0) + 1;
      if (counts[family] > buildingConfig.maxFamilyCopies)
        fail(`buildings.json.${family}`, "la famille dépasse maxFamilyCopies, variantes comprises.");
    }
  }
  if (!buildings[buildingConfig.startingBuilding]?.housing)
    fail(
      "buildings.json.startingBuilding",
      "choisissez un bâtiment doté de logements.",
    );
  const start = buildings[buildingConfig.startingBuilding];
  if (
    !start.terrain.some((id) => terrainDefinitions[id].walkable) &&
    !start.traversable
  )
    fail(
      "buildings.json.startingBuilding",
      "le terrain d’entrée doit être praticable par le roi.",
    );
  object(missionConfig, "missions.json");
  integer(missionConfig.marketSize, "missions.json.marketSize", 1);
  if (missionConfig.marketSize !== 3)
    fail("missions.json.marketSize", "trois missions communes sont requises.");
  const missions = index(
    structuredClone(missionConfig.missions),
    "missions.json.missions",
  );
  if (Object.keys(missions).length < 3)
    fail("missions.json.missions", "au moins trois missions sont requises.");
  for (const m of Object.values(missions)) {
    const path = `missions.json.${m.id}`;
    if (!["revealed", "built", "recruited", "resources"].includes(m.metric))
      fail(path, "objectif inconnu.");
    identifier(m.family, `${path}.family`);
    integer(m.difficulty, `${path}.difficulty`, 1);
    if (m.difficulty > 3)
      fail(path, "la difficulté doit valoir 1, 2 ou 3 étoiles.");
    integer(m.target, `${path}.target`, 1);
    object(m.reward, `${path}.reward`);
    integer(m.reward.prestige, `${path}.reward.prestige`, 1);
    if (Object.keys(m.reward).some((k) => k !== "prestige"))
      fail(path, "seule une récompense de prestige est prise en charge.");
    for (const [field, metric, definitions] of [
      ["terrain", "revealed", terrainDefinitions],
      ["building", "built", buildings],
      ["resource", "resources", resources],
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
      variants.length !== 3 ||
      variants.some((m, i) => m.difficulty !== i + 1)
    )
      fail(
        `missions.json.${family}`,
        "chaque objectif doit avoir exactement une version à 1, 2 et 3 étoiles.",
      );
    const objective = (m) =>
      JSON.stringify([m.metric, m.terrain, m.building, m.resource]);
    if (variants.some((m) => objective(m) !== objective(variants[0])))
      fail(
        `missions.json.${family}`,
        "les trois niveaux doivent concerner le même objectif.",
      );
    if (
      variants[1].target <= variants[0].target ||
      variants[2].target <= variants[1].target
    )
      fail(
        `missions.json.${family}`,
        "les seuils doivent augmenter avec la difficulté.",
      );
  }
  if ([...families.values()].length < missionConfig.marketSize)
    fail(
      "missions.json.missions",
      "au moins trois objectifs distincts sont requis.",
    );
  return {
    missions,
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
    recruitmentCost: resourceConfig.recruitmentCost,
  };
}
