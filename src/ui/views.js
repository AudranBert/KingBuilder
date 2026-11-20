import { t, definitionText, translateMessage, kingdomName, getLanguage } from "../i18n.js";
import { iconHTML } from "./html.js";
import { piece } from "./pieces.js";
import { CONFIG } from "../configuration.js";
import { MAPS } from "../maps.js";
import { hasSelectedUnit } from "./state.js";
import {
  RULES,
  createGame,
  GAME_DEFAULTS,
  GOLD,
  MISSIONS,
  missionProgress,
  missionTarget,
  harvestPreview,
  TERRAINS,
  RESOURCES,
  RESOURCE_DEFINITIONS,
  BUILDINGS,
  UNIT_DEFINITIONS,
  actor,
  totalScore,
  score,
  assigned,
  workersAt,
  productionAmount,
  buildingAt,
  moveError,
  trainError,
  armyAt,
  selectedSoldiers,
  attackPaths,
  combatPreview,
  defenseAt,
} from "../engine.js";
import { costPayment, tradePrice } from "../objectives.js";
import { key, parseKey } from "../geometry.js";
import {
  e,
  costHTML,
  costText,
  coordinates,
  terrainDiagram,
  buildingDiagram,
} from "./html.js";

function dragHandleHTML() {
  return `<span class="card-drag-handle" data-card-drag aria-hidden="true" title="${e(t("placement.dragHandle"))}">⠿</span>`;
}

function mapsCatalogueView(size) {
  const boardSize = Number(size);
  return `<section id="catalogue-maps" aria-label="${t("maps.catalogue")}" hidden>
    <div class="catalogue-filters"><label>${t("maps.previewSize")}<select data-catalogue-filter="mapSize">${[9, 11, 13].map(n => `<option value="${n}" ${n === boardSize ? 'selected' : ''}>${n} × ${n}</option>`).join('')}</select></label></div>
    <p class="map-preview-legend">${t("maps.previewLegend")}</p>
    <div class="catalogue-grid">${MAPS.map(map => {
      const game = createGame(() => .5, 'local', { mapId: map.id, boardSize });
      const name = map.name[getLanguage()];
      const flags = Object.values(game.board).filter(cell => cell.flag).length;
      const cells = Array.from({ length: boardSize ** 2 }, (_, i) => {
        const x = i % boardSize, y = Math.floor(i / boardSize), cell = game.board[key(x, y)];
        const symbol = cell?.flag ? '⚑' : cell?.building ? '♜' : '';
        const color = cell?.building ? cell.building.owner === 0 ? '#a85b00' : '#156958' : '#483819';
        return `<rect x="${x * 20}" y="${y * 20}" width="19" height="19" rx="2" fill="${cell ? TERRAINS[cell.terrain].color : '#f1eadb'}"/>${symbol ? `<text x="${x * 20 + 9.5}" y="${y * 20 + 10}" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="bold" fill="${color}" stroke="#fff8e8" stroke-width=".65" paint-order="stroke">${symbol}</text>` : ''}`;
      }).join('');
      return `<article class="catalogue-card" data-catalogue-map="${e(map.id)}"><h3>${e(name)}</h3><svg class="map-preview" viewBox="0 0 ${boardSize * 20} ${boardSize * 20}" role="img" aria-label="${e(t("maps.previewLabel", [name, boardSize, flags]))}">${cells}</svg><p>${e(map.description[getLanguage()])}</p></article>`;
    }).join('')}</div></section>`;
}

export function catalogueView({ tier = "all", tileSize = "all", terrain = "all", tileSort = "size", mapSize = GAME_DEFAULTS.boardSize } = {}) {
  const families = new Map();
  for (const b of Object.values(BUILDINGS)) {
    const id = b.family || b.id;
    if (!families.has(id)) families.set(id, []);
    families.get(id).push(b);
  }
  const legend = `<p class="building-legend">${Object.values(TERRAINS).map(terrain => `<span><i style="background:${terrain.color}">${iconHTML(terrain.icon)}</i>${e(definitionText("terrains", terrain))}</span>`).join("")}</p>`;
  const visibleFamilies = [...families.values()].filter(v => tier === "all" || v[0].tier === Number(tier)).sort((a, b) => a[0].tier - b[0].tier);
  const terrainCount = tile => new Set(tile.cells.map(c => c.terrain)).size;
  const terrainSignature = tile => [...new Set(tile.cells.map(c => definitionText("terrains", TERRAINS[c.terrain])))].sort().join(" / ");
  const tiles = CONFIG.tiles.filter(tile => (tileSize === "all" || tile.cells.length === Number(tileSize)) && (terrain === "all" || tile.cells.some(c => c.terrain === terrain)));
  tiles.sort((a, b) => {
    const primary = tileSort === "size-desc" ? b.cells.length - a.cells.length
      : tileSort === "terrain" ? terrainSignature(a).localeCompare(terrainSignature(b), getLanguage())
      : tileSort === "diversity" ? terrainCount(a) - terrainCount(b)
      : a.cells.length - b.cells.length;
    return primary || a.cells.length - b.cells.length || definitionText("tiles", a).localeCompare(definitionText("tiles", b), getLanguage());
  });
  const options = (values, current) => values.map(([value, label]) => `<option value="${e(value)}" ${String(value) === String(current) ? "selected" : ""}>${e(label)}</option>`).join("");
  const tierFilters = `<div class="catalogue-filters" role="group" aria-label="${t("catalogueView.filterBuildingsByTier")}">${["all", 0, 1, 2, 3].map(value => `<button data-catalogue-tier="${value}" aria-pressed="${String(tier) === String(value)}">${value === "all" ? t("views.allTiers") : t("catalogue.tier", [value])}</button>`).join("")}</div>`;
  const tileFilters = `<div class="catalogue-filters"><label>${t("catalogueView.numberOfSpaces")}<select data-catalogue-filter="tileSize">${options([["all", t("views.allSizes")], ...[...new Set(CONFIG.tiles.map(t => t.cells.length))].sort((a,b) => a-b).map(n => [n, t("views.spaces", [n])])], tileSize)}</select></label><label>${t("catalogueView.containsTerrain")}<select data-catalogue-filter="terrain">${options([["all", t("views.allTerrains")], ...[...new Set(CONFIG.tiles.flatMap(t => t.cells.map(c => c.terrain)))].map(id => [id, definitionText("terrains", TERRAINS[id])])], terrain)}</select></label><label>${t("catalogueView.sortBy")}<select data-catalogue-filter="tileSort">${options([["size", t("views.numberOfSpacesAscending")], ["size-desc", t("views.numberOfSpacesDescending")], ["terrain", t("views.terrainType")], ["diversity", t("views.numberOfTerrainTypes")]], tileSort)}</select></label></div>`;
  return `${legend}<section id="catalogue-buildings" aria-label="${t("catalogueView.buildingCards")}">${tierFilters}<p role="status">${t("catalogueView.familiesCardsInTheDeckVariantsAre", [visibleFamilies.length, families.size, CONFIG.buildingDeckSize])}</p><div class="catalogue-grid">${visibleFamilies.map(variants => {
    const b = variants[0];
    const quantity = variants.reduce((sum, v) => sum + (v.constructible === false ? 0 : v.weight), 0);
    return `<article class="catalogue-card" data-catalogue-family="${e(b.family || b.id)}"><h3>${buildingStars(b)} ${e([...new Set(variants.map(v => definitionText("buildings", v)))].join(" / "))}</h3><p>${b.constructible === false ? t("views.startingBuildingOutsideTheDeck") : t("views.copiesCost", [quantity, costHTML(b.cost)])}</p><p>${e(buildingDescription(b))} · ${t("common.points", [b.points || 0])}</p><div class="catalogue-patterns">${variants.map(v => `<figure data-catalogue-building="${e(v.id)}"><div class="catalogue-diagram">${buildingDiagram(v.id, 0, true)}</div><figcaption>${e(definitionText("buildings", v, "pattern"))}</figcaption></figure>`).join("")}</div></article>`;
  }).join("")}</div>${visibleFamilies.length ? "" : `<p class="empty-state">${t("catalogueView.noBuildingsInThisTierYet")}</p>`}</section><section id="catalogue-tiles" aria-label="${t("catalogueView.terrainTiles")}" hidden>${tileFilters}<p role="status">${t("catalogueView.tilesCopiesInTheDeck", [tiles.length, CONFIG.tiles.length, CONFIG.tileDeckSize])}</p><div class="catalogue-grid">${tiles.map(tile => `<article class="catalogue-card" data-catalogue-tile="${e(tile.id)}"><h3>${e(definitionText("tiles", tile))}</h3><div class="catalogue-diagram">${terrainDiagram(tile, 0, 160)}</div><p>${t("catalogueView.spaces", [tile.cells.length, e(definitionText("shapes", CONFIG.shapes[tile.shapeId]))])}</p><p>${t("catalogueView.terrainTypeS", [e(terrainSignature(tile)), terrainCount(tile)])}</p><p>${e(definitionText("tiles", tile, "intent") || "")}</p></article>`).join("")}</div>${tiles.length ? "" : `<p class="empty-state">${t("catalogueView.noTilesMatchTheseFilters")}</p>`}</section>${mapsCatalogueView(mapSize)}`;
}

export function playersView(g) {
  return g.players
    .map(
      (p, i) =>
        `<article class="player ${i === 1 ? "jade" : ""} ${g.active === i && !g.finished ? "active" : ""}" aria-label="${e(kingdomName(p.name))}${g.active === i && !g.finished ? t("views.yourTurn") : ""}"><div class="crest" aria-hidden="true">${piece("king")}</div><div class="player-name"><h2>${e(kingdomName(p.name))}</h2></div><div class="resources">${Object.entries(
          RESOURCE_DEFINITIONS,
        )
          .map(
            ([id, r]) =>
              `<div class="resource" title="${e(definitionText("resources", r))}" aria-label="${p.resources[id] ?? 0} ${e(definitionText("resources", r))}"><em aria-hidden="true">${iconHTML(r.icon)}</em>${p.resources[id] ?? 0}<small>${e(definitionText("resources", r))}</small></div>`,
          )
          .join(
            "",
          )}</div><div class="player-score" title="${t("playersView.currentScore")}"><b>${totalScore(g, i)}</b><small>★</small></div></article>`,
    )
    .join("");
}

export function trainingView(g, position, b, readOnly = false) {
  const [x, y] = parseKey(position);
  return BUILDINGS[b.type].trains
    .map((type) => {
      const unit = UNIT_DEFINITIONS[type],
        error = readOnly ? t("mode.inspectOnly") : translateMessage(trainError(g, x, y, type));
      const payment = costPayment(g,unit.cost);
      return `<div class="training-option"><button class="train-unit secondary" data-action="train" data-type="${e(type)}" data-position="${position}" title="${e(error || t("views.recruitActiveNextTurn", [definitionText("units", unit).toLowerCase()]))}" ${error ? "disabled" : ""}>+1 ${iconHTML(unit.icon)}<small>${costHTML(payment.resources)}</small></button></div>`;
    })
    .join("");
}
export function barracksView(g, ui = {}) {
  return Object.entries(g.board)
    .filter(
      ([, c]) =>
        c.building?.owner === g.active && BUILDINGS[c.building.type].trains,
    )
    .map(
      ([position, c]) =>
        `<div class="barracks-card"><strong>${e(definitionText("buildings", BUILDINGS[c.building.type]))} (${coordinates(...parseKey(position))})</strong>${trainingView(g, position, c.building, ui.mode === 'inspect')}</div>`,
    )
    .join("");
}

export function workersView(g, ui = {}) {
  return g.players[g.active].workerAssignments
    .filter((w) => !w.building)
    .map(
      (w) =>
        `<button class="free-worker worker-drag-handle ${g.active === 1 ? "jade" : ""}" data-worker-drag="${w.id}" aria-label="${t("workersView.available", [e(definitionText("units", UNIT_DEFINITIONS.worker)), w.id + 1])}" title="${t("workersView.dragToABuilding")}" ${g.finished || ui.mode === 'inspect' ? "disabled" : ""}>${piece("worker")}</button>`,
    )
    .join("");
}
export function harvestView(g) {
  if (g.finished) return `<strong>${t("harvestView.gameOverFinalHarvestCompleted")}</strong>`;
  const { inactive } = harvestPreview(g);
  const gains = harvestGains(g);
  const free = g.players[g.active].workerAssignments.some(w => !w.building);
  return `<strong>${t("harvestView.endOfTurn", [gains || t("app.noHarvest")])}</strong>${inactive.length ? `<div class="inactive-list">${inactive.map(position => {
    const b = g.board[position].building;
    return `<span>${t("harvestView.without", [e(definitionText("buildings", BUILDINGS[b.type])), coordinates(...parseKey(position)), e(definitionText("units", UNIT_DEFINITIONS.worker).toLowerCase()), free ? `<button class="secondary" data-action="assign" data-position="${position}">${t("harvestView.assignAFree", [e(definitionText("units", UNIT_DEFINITIONS.worker).toLowerCase())])}</button>` : ""])}</span>`;
  }).join("")}</div>` : ""}`;
}

export function harvestGains(g) {
  return Object.entries(harvestPreview(g).amounts).filter(([, amount]) => amount > 0)
    .map(([id, amount]) => `+${amount} ${e(t(`resources.${id}.name`).toLowerCase())}`).join(" · ") || t("app.noHarvest");
}

export function terrainMarketView(g, ui) {
  return (
    (g.opening ? g.opening.tiles : g.tileMarket)
      .map((tile, i) => {
        const choice = ui.drag || ui.placement;
        const selected = choice?.kind === "terrain" && choice.index === i;
        return `<button class="tile-card ${selected ? "selected" : ""}" draggable="false" title="${e(definitionText("tiles", tile))}${definitionText("tiles", tile, "intent") ? " · " + e(definitionText("tiles", tile, "intent")) : ""}" data-tile="${i}" aria-pressed="${selected}" aria-label="${t("terrainMarketView.spaces", [e(definitionText("tiles", tile) || t("views.terrainTile")), tile.cells.length])}" ${g.finished || ui.mode === "inspect" ? "disabled" : ""}>${terrainDiagram(tile, ui.rotation, RULES.markets.terrainSize >= 4 ? 48 : 64)}${dragHandleHTML()}</button>`;
      })
      .join("") ||
    `<p class="empty-state">${t("terrainMarketView.theTerrainDeckIsEmpty")}</p>`
  );
}
export function singleTerrainView(g, ui) {
  if (g.opening) return "";
  const unit = actor(g);
  const cost = RULES.trade.singleTerrainCost;
  const disabled = g.finished || ui.mode === 'inspect' || unit.type === "soldier" || unit.acted || unit.ended || g.players[g.active].resources.gold < cost;
  return `<div class="single-terrain-label" title="${t("singleTerrainView.buyATerrainSpaceForGold", [cost])}">${t("singleTerrainView.1Space", [cost, iconHTML(RESOURCE_DEFINITIONS.gold.icon)])}</div><div class="single-terrain-market" aria-label="${t("singleTerrainView.buyATerrainSpaceForGold", [cost])}">${["plain", "forest", "mountain", "river"].map(id => {
    const selected = (ui.drag || ui.placement)?.kind === "single-terrain" && (ui.drag || ui.placement).terrain === id;
    return `<button class="tile-card ${selected ? "selected" : ""}" data-single-terrain="${id}" draggable="false" aria-label="${t("singleTerrainView.buyASpaceOfForGold", [e(definitionText("terrains", TERRAINS[id]).toLowerCase()), cost])}" aria-pressed="${selected}" title="${t("singleTerrainView.gold", [e(definitionText("terrains", TERRAINS[id])), cost])}" ${disabled ? "disabled" : ""}>${iconHTML(TERRAINS[id].icon)}${dragHandleHTML()}</button>`;
  }).join("")}</div>`;
}
export function buildingMarketView(g, ui) {
  return (
    g.buildingMarket
      .map((type, i) => {
        const b = BUILDINGS[type],
          choice = ui.drag || ui.placement,
          selected = choice?.kind === "building" && choice.index === i;
        return `<div class="building-offer"><button class="building-card ${selected ? "selected" : ""}" draggable="false" title="${t("buildingMarketView.clickToSeePlacementsDragToBuild")}" data-building="${i}" aria-pressed="${selected}" ${g.opening || g.finished || ui.mode === "inspect" ? "disabled" : ""}><span class="building-pattern-slot">${buildingDiagram(type, ui.buildingRotation)}</span><span class="building-info"><strong>${buildingStars(b)} ${e(definitionText("buildings", b))}</strong><span class="building-effect">${buildingEffectHTML(b)}</span><span class="cost">${costHTML(b.cost)}${b.points ? `<span class="building-points">· ${b.points} ★</span>` : ""}</span></span>${dragHandleHTML()}</button><button class="secondary offer-details" data-building-details="${e(type)}" data-building-orientation="${ui.buildingRotation}" aria-haspopup="dialog" aria-label="${t("buildingMarketView.viewDetailsFor", [e(definitionText("buildings", b))])}" title="${t("buildingMarketView.viewDetailsFor", [e(definitionText("buildings", b))])}">${t("buildingMarketView.i")}</button></div>`;
      })
      .join("") ||
    `<p class="empty-state">${t("buildingMarketView.theBuildingDeckIsEmpty")}</p>`
  );
}
function buildingDescription(b) {
  const description = definitionText("buildings", b, "description");
  return b.garrison ? `${description} ${t("building.defense", [b.garrison + 1, b.garrison, 1])}` : description;
}
function buildingEffectHTML(b) {
  const label = buildingDescription(b);
  let effect;
  if (b.grantsWorker) effect = `+${b.grantsWorker} ${iconHTML(UNIT_DEFINITIONS.worker.icon)}`;
  else if (b.produces) effect = `+${b.production} ${iconHTML(RESOURCE_DEFINITIONS[b.produces].icon)} / ${iconHTML("assets/textures/icon-hourglass.svg")}`;
  else if (b.boost) effect = `×${b.boost.multiplier} ${iconHTML(RESOURCE_DEFINITIONS[BUILDINGS[b.boost.target].produces].icon)}`;
  else if (b.trains) effect = `+1 ${iconHTML(UNIT_DEFINITIONS[b.trains[0]].icon)} · +${b.trainingLimit} / ${iconHTML("assets/textures/icon-hourglass.svg")}`;
  else if (b.onBuildUnit) effect = `+1 ${iconHTML(UNIT_DEFINITIONS[b.onBuildUnit].icon)} · max. 1`;
  else if (b.garrison) effect = `${iconHTML("assets/textures/icon-shield.svg")} ${b.garrison + 1}`;
  else if (b.transformTo) effect = `${iconHTML(TERRAINS.forest.icon)} → ${iconHTML(TERRAINS[b.transformTo].icon)} · +${b.onBuildGain.material} ${iconHTML(RESOURCE_DEFINITIONS.material.icon)}`;
  else if (b.traversable) effect = `${iconHTML(TERRAINS[b.terrain[0]].icon)} → ↔`;
  else if (b.id === "monument") effect = `★ ${b.points}`;
  else effect = e(label);
  return `<span title="${e(label)}" aria-label="${e(label)}">${effect}</span>`;
}
function buildingStars(b) {
  return `<span class="building-stars" aria-label="${t("buildingStars.star", [b.tier, b.tier > 1 ? "s" : ""])}">${b.tier ? "★".repeat(b.tier) : "☆"}</span>`;
}
export function buildingDetailsView(type, rotation = 0) {
  const b = BUILDINGS[type];
  if (!b) return "";
  const terrains = [...new Set(b.cells.flatMap(c => [...c.terrain, ...(c.transformTo ? [c.transformTo] : [])]))];
  const effect = b.id === "monument"
    ? t("views.noEffectValuePointS", [b.points])
    : `<strong>${t("buildingDetailsView.effect")}</strong> ${e(buildingDescription(b))} ${t("buildingDetailsView.value", [b.points || 0])}`;
  return `<div class="building-detail-heading">${buildingStars(b)}<h2 id="building-details-title">${e(definitionText("buildings", b))}</h2></div><div class="building-detail-diagram">${buildingDiagram(type, rotation, true)}</div><p class="building-legend">${terrains.map(id => `<span><i style="background:${TERRAINS[id].color}">${iconHTML(TERRAINS[id].icon)}</i>${e(definitionText("terrains", TERRAINS[id]))}</span>`).join("")}</p><p>${e(definitionText("buildings", b, "pattern"))}</p><p>${effect}</p><p><strong>${b.constructible === false ? t("views.availability") : t("views.cost")} :</strong> ${b.constructible === false ? t("views.startingBuildingOnly") : costHTML(b.cost)}</p>`;
}

export function selectionView(g, ui) {
  const unitSelected = hasSelectedUnit(g, ui);
  const selectedUnit = unitSelected ? actor(g) : null;
  const movesLeft = selectedUnit && !selectedUnit.acted && !selectedUnit.ended ? Math.max(0, selectedUnit.moves) : 0;
  const armyControls = selectedUnit
    ? `<span class="selected-unit-icon ${g.active === 1 ? 'jade' : ''}" role="img" aria-label="${e(definitionText('units', UNIT_DEFINITIONS[selectedUnit.type]))}" title="${e(definitionText('units', UNIT_DEFINITIONS[selectedUnit.type]))}">${piece(selectedUnit.type)}</span><span class="selected-unit-moves" title="${t('selectionView.movesRemaining', [movesLeft])}" aria-label="${t('selectionView.movesRemaining', [movesLeft])}"><b>${movesLeft}</b>${iconHTML('assets/textures/icon-boots.svg')}</span>${armyControlsView(g)}`
    : '';
  if (!ui.selected) return armyControls;
  const pos = ui.selected,
    cell = g.board[key(pos.x, pos.y)],
    site = buildingAt(g, pos.x, pos.y),
    b = site?.building,
    unit = actor(g);
  let html = armyControls + (b ? `<div class="selected-building">${iconHTML(BUILDINGS[b.type].icon, "selected-building-icon")}<strong>${e(definitionText("buildings", BUILDINGS[b.type]))} · ${buildingEffectHTML(BUILDINGS[b.type])}</strong><button data-building-details="${e(b.type)}" data-building-orientation="${b.rotation || 0}" aria-haspopup="dialog" aria-label="${t("selectionView.detailsFor", [e(definitionText("buildings", BUILDINGS[b.type]))])}" class="secondary offer-details">${t("buildingMarketView.i")}</button></div>` : "");
  if (cell?.flag) html += `<strong title="${cell.flag.owner === null ? t("views.neutral") : e(kingdomName(g.players[cell.flag.owner].name))}">${iconHTML("assets/textures/icon-flag.svg")} · ★ ${RULES.points.flag}</strong>`;
  if (g.finished || ui.mode === 'inspect') return html;
  if (unitSelected && attackPaths(g).has(key(pos.x,pos.y))) {
    const r = combatPreview(g,pos.x,pos.y);
    html += `<div class="combat-summary"><strong title="${t("selectionView.attackDefense")}">${iconHTML("assets/textures/icon-attack.svg")} ${r.attack} · ${iconHTML("assets/textures/icon-shield.svg")} ${r.defense}</strong><span title="${t("selectionView.survivingSoldiersAttackerDefender")}">→ ${iconHTML("assets/textures/units-soldier.svg")} ${r.attackerSurvivors} / ${Math.max(0,r.defenderSurvivors-r.garrison)}${r.garrison ? ` · ${iconHTML("assets/textures/icon-shield.svg")} ${r.attackerSurvivors ? "0" : "1"}` : ""}</span><button data-action="attack" class="primary">${cell?.flag && !r.defense ? t("views.capture") : t("views.attack")}</button></div>`;
  }
  if (b?.owner === g.active && BUILDINGS[b.type].produces) {
    const assignedWorker = workersAt(g, g.active, site.x, site.y).length > 0,
      noFree =
        !assignedWorker && assigned(g, g.active) >= g.players[g.active].workers;
    html += `<button data-action="assign" data-position="${key(site.x, site.y)}" class="secondary" ${noFree ? "disabled" : ""}>${assignedWorker ? t("views.release", [e(definitionText("units", UNIT_DEFINITIONS.worker).toLowerCase())]) : t("views.assignA", [e(definitionText("units", UNIT_DEFINITIONS.worker).toLowerCase())])}</button>`;
    if (noFree)
      html +=
        `<small class="selection-reason">${t("selectionView.allYourAreBusyReassignOneFrom", [e(definitionText("units", UNIT_DEFINITIONS.worker).toLowerCase())])}</small>`;
  }
  if (b?.owner === g.active && BUILDINGS[b.type].trains)
    html += trainingView(g, key(site.x, site.y), b);
  if (
    unitSelected && cell &&
    (pos.x !== unit.x || pos.y !== unit.y) &&
    !moveError(g, pos.x, pos.y)
  )
    html +=
      `<button data-action="move" class="primary">${t("selectionView.moveToThisSpace")}</button>`;
  return html;
}

export function resultsView(g) {
  return g.players
    .map(
      (p, i) =>
        `<div class="result-card"><h3>${e(kingdomName(p.name))}</h3>${Object.entries(
          score(g, i),
        )
          .map(
            ([id, n]) =>
              `<p><span>${{ flags: t("views.flags"), buildings: t("views.buildings"), gold: t("views.gold1", [RULES.points.goldPerPoint]) }[id]}</span><strong>${n}</strong></p>`,
          )
          .join(
            "",
          )}<p class="result-total"><span>${t("resultsView.total")}</span><strong>${totalScore(g, i)}</strong></p></div>`,
    )
    .join("");
}
export function armyControlsView(g) {
  const unit = actor(g);
  if (unit.type !== "soldier" || g.finished) return "";
  const total = armyAt(g,g.active,unit.x,unit.y), ready = total.filter(u => !u.acted && !u.ended);
  const attack = selectedSoldiers(g).length;
  const defense = defenseAt(g, g.active, unit.x, unit.y);
  return `<div class="army-controls"><div class="army-strength"><span class="army-stat" data-army-stat="attack" aria-label="${t("army.attackPower", [attack])}" title="${t("army.attackExplanation")}">${iconHTML("assets/textures/icon-sword.svg")}<b>${attack}</b></span><span class="army-stat" data-army-stat="defense" aria-label="${t("army.defensePower", [defense.defense])}" title="${t("army.defenseExplanation", [defense.defenders, defense.garrison, defense.bonus])}">${iconHTML("assets/textures/icon-shield.svg")}<b>${defense.defense}</b></span></div>${ready.length ? `<label>${t("armyControlsView.armySize")}<select data-army-size aria-label="${t("armyControlsView.selectedStackSize")}">${ready.map((_,i) => `<option value="${i+1}" ${selectedSoldiers(g).length === i+1 ? "selected" : ""}>${i+1}</option>`).join("")}</select></label>` : `<span>${t("armyControlsView.activationComplete")}</span>`}</div>`;
}
export function tradeView(g) {
  return `<span title="${t("tradeView.buyingMissingResourcesBasePricePerEnemy", [RULES.trade.basePrice, RULES.trade.producerSurcharge])}"><strong>${t("tradeView.bank")}</strong> · ${tradePrice(g,"food")} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)} → ${iconHTML(RESOURCE_DEFINITIONS.food.icon)} · ${tradePrice(g,"material")} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)} → ${iconHTML(RESOURCE_DEFINITIONS.material.icon)}</span>`;
}
export function rulesView(g) {
  const size = g?.boardSize ?? GAME_DEFAULTS.boardSize,
    rounds = g?.turnLimit ?? GAME_DEFAULTS.rounds,
    openingCount = g?.openingTilesPerPlayer ?? GAME_DEFAULTS.openingTilesPerPlayer;
  return `<h3>${t("rulesView.1TheGoal")}</h3>
  <p>${t("rulesView.conquerTheEnemyKeepWithASurviving", [rounds, RULES.points.flag, RULES.points.goldPerPoint])}</p>
  <h3>${t("rulesView.2SetUpTheBoard")}</h3>
  <p>${g?.mapId ? t(openingCount ? "maps.setupWithDraft" : "maps.setup", [size, openingCount]) : t(g?.missionsEnabled === false ? "rulesView.setupWithoutMissions" : "rulesView.onTheBoardEachPlayerPlacesSetup", [size, size, openingCount])}</p>
  <h3>${t("rulesView.3TakeYourTurn")}</h3>
  <p>${t("rulesView.eachUnitHasMovesAlongSharedEdges", [UNIT_DEFINITIONS.king.moves])}</p>
  <h3>${t("rulesView.4ExploreAndBuild")}</h3>
  <p>${t("rulesView.placeATerrainTileTouchingTheBuilder", [RULES.trade.singleTerrainCost])}</p>
  <p>${t("rulesView.toBuildPayTheCostAndPlace")}</p>
  <h3>${t("rulesView.5ProduceAndProgress")}</h3>
  <p>${t(g?.missionsEnabled === false ? "rulesView.productionWithoutMissions" : "rulesView.aHouseProvidesOneWorkerAssignIt")}</p>
  <p>${t("rulesView.rerollingTheMarketCostsGoldOncePer", [GOLD.rerollCost])}</p>
  <h3>${t("rulesView.6FightAndConquer")}</h3>
  <p>${t("rulesView.groupYourSoldiersOrChooseANumber")}</p>
  <p>${t("rulesView.withASurvivorOccupyAFlagTo")}</p>
  <h3>${t("rulesView.7MoveThePieces")}</h3>
  <p>${t("rulesView.clickOrDragUnitsAndCardsR")}</p>`;
}

export function missionsView(g) {
  if (g.missionsEnabled === false) return '';
  return (
    g.missions.market
      .map((id) => {
        const m = MISSIONS[id];
        const symbol = m.metric === "built" ? iconHTML(BUILDINGS[m.building]?.icon || "assets/textures/buildings-house.svg")
          : m.metric === "revealed" ? iconHTML(TERRAINS[m.terrain]?.icon || "assets/textures/icon-terrain.svg")
          : m.metric === "recruited" ? iconHTML(UNIT_DEFINITIONS.worker.icon)
          : m.resource ? iconHTML(RESOURCE_DEFINITIONS[m.resource].icon) : "";
        const label = {built:t("views.build"),revealed:t("views.explore"),recruited:t("views.recruit"),resources:t("views.stock")}[m.metric];
        const summary = m.metric === "resources" && !m.resource
          ? t("missionsView.totalResources", [m.target])
          : `${label} ${symbol} ${m.target}`;
        const explanation = m.metric === "resources" && !m.resource ? ` · ${t("missionsView.totalResourcesExplanation")}` : '';
        return `<article class="mission-card" title="${t("missionsView.firstComeFirstServed", [e(definitionText("missions", m))])}${explanation}" aria-label="${e(definitionText("missions", m))}"><div><strong><span class="mission-stars" aria-label="${t("missionsView.difficultyOf", [m.difficulty, RULES.missionRules.maxDifficulty])}">${"★".repeat(m.difficulty)}</span>${summary}</strong><b>+${m.reward.gold} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)}</b></div><div class="mission-progress">${g.players
          .map((p, i) => {
            const progress = missionProgress(g, id, i), target = missionTarget(g, id, i);
            return `<span class="${i === 1 ? "jade" : "amber"}" title="${target > m.target ? t("views.requiredContribution", [RULES.missionRules.requiredContribution]) : e(kingdomName(p.name))}" aria-label="${t("missionsView.of", [e(kingdomName(p.name)), progress, target])}">${Math.min(target, progress)}/${target}</span>`;
          })
          .join("")}</div></article>`;
      })
      .join("") ||
    `<span class="missions-empty">${t("missionsView.noMissionsRemaining")}</span>`
  );
}
