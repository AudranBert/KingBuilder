import { iconHTML } from "./html.js";
import { piece } from "./pieces.js";
import { CONFIG } from "../configuration.js";
import {
  RULES,
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

export function catalogueView({ tier = "all", tileSize = "all", terrain = "all", tileSort = "size" } = {}) {
  const families = new Map();
  for (const b of Object.values(BUILDINGS)) {
    const id = b.family || b.id;
    if (!families.has(id)) families.set(id, []);
    families.get(id).push(b);
  }
  const legend = `<p class="building-legend">${Object.values(TERRAINS).map(t => `<span><i style="background:${t.color}">${iconHTML(t.icon)}</i>${e(t.name)}</span>`).join("")}</p>`;
  const visibleFamilies = [...families.values()].filter(v => tier === "all" || v[0].tier === Number(tier)).sort((a, b) => a[0].tier - b[0].tier);
  const terrainCount = tile => new Set(tile.cells.map(c => c.terrain)).size;
  const terrainSignature = tile => [...new Set(tile.cells.map(c => TERRAINS[c.terrain].name))].sort().join(" / ");
  const tiles = CONFIG.tiles.filter(tile => (tileSize === "all" || tile.cells.length === Number(tileSize)) && (terrain === "all" || tile.cells.some(c => c.terrain === terrain)));
  tiles.sort((a, b) => {
    const primary = tileSort === "size-desc" ? b.cells.length - a.cells.length
      : tileSort === "terrain" ? terrainSignature(a).localeCompare(terrainSignature(b), "fr")
      : tileSort === "diversity" ? terrainCount(a) - terrainCount(b)
      : a.cells.length - b.cells.length;
    return primary || a.cells.length - b.cells.length || a.name.localeCompare(b.name, "fr");
  });
  const options = (values, current) => values.map(([value, label]) => `<option value="${e(value)}" ${String(value) === String(current) ? "selected" : ""}>${e(label)}</option>`).join("");
  const tierFilters = `<div class="catalogue-filters" role="group" aria-label="Filtrer les bâtiments par tier">${["all", 0, 1, 2, 3].map(value => `<button data-catalogue-tier="${value}" aria-pressed="${String(tier) === String(value)}">${value === "all" ? "Tous les tiers" : `Tier ${value}`}</button>`).join("")}</div>`;
  const tileFilters = `<div class="catalogue-filters"><label>Nombre de cases<select data-catalogue-filter="tileSize">${options([["all", "Toutes les tailles"], ...[...new Set(CONFIG.tiles.map(t => t.cells.length))].sort((a,b) => a-b).map(n => [n, `${n} cases`])], tileSize)}</select></label><label>Terrain présent<select data-catalogue-filter="terrain">${options([["all", "Tous les terrains"], ...[...new Set(CONFIG.tiles.flatMap(t => t.cells.map(c => c.terrain)))].map(id => [id, TERRAINS[id].name])], terrain)}</select></label><label>Trier par<select data-catalogue-filter="tileSort">${options([["size", "Nombre de cases croissant"], ["size-desc", "Nombre de cases décroissant"], ["terrain", "Type de terrain"], ["diversity", "Nombre de types de terrain"]], tileSort)}</select></label></div>`;
  return `${legend}<section id="catalogue-buildings" aria-label="Cartes Bâtiment">${tierFilters}<p role="status">${visibleFamilies.length} / ${families.size} familles · ${CONFIG.buildingDeckSize} cartes dans la pioche. Les variantes sont regroupées.</p><div class="catalogue-grid">${visibleFamilies.map(variants => {
    const b = variants[0];
    const quantity = variants.reduce((sum, v) => sum + (v.constructible === false ? 0 : v.weight), 0);
    return `<article class="catalogue-card" data-catalogue-family="${e(b.family || b.id)}"><h3>${buildingStars(b)} ${e([...new Set(variants.map(v => v.name))].join(" / "))}</h3><p>${b.constructible === false ? "Bâtiment de départ · hors pioche" : `${quantity} exemplaires · Coût : ${costHTML(b.cost)}`}</p><p>${e(buildingDescription(b))} · ${b.points || 0} point(s)</p><div class="catalogue-patterns">${variants.map(v => `<figure data-catalogue-building="${e(v.id)}"><div class="catalogue-diagram">${buildingDiagram(v.id, 0, true)}</div><figcaption>${e(v.pattern)}</figcaption></figure>`).join("")}</div></article>`;
  }).join("")}</div>${visibleFamilies.length ? "" : '<p class="empty-state">Aucun bâtiment dans ce tier pour le moment.</p>'}</section><section id="catalogue-tiles" aria-label="Tuiles Terrain" hidden>${tileFilters}<p role="status">${tiles.length} / ${CONFIG.tiles.length} tuiles · ${CONFIG.tileDeckSize} exemplaires dans la pioche.</p><div class="catalogue-grid">${tiles.map(tile => `<article class="catalogue-card" data-catalogue-tile="${e(tile.id)}"><h3>${e(tile.name)}</h3><div class="catalogue-diagram">${terrainDiagram(tile, 0, 160)}</div><p>${tile.cells.length} cases · ${e(CONFIG.shapes[tile.shapeId].name)}</p><p>${e(terrainSignature(tile))} · ${terrainCount(tile)} type(s) de terrain</p><p>${e(tile.intent || "")}</p></article>`).join("")}</div>${tiles.length ? "" : '<p class="empty-state">Aucune tuile ne correspond à ces filtres.</p>'}</section>`;
}

export function playersView(g) {
  return g.players
    .map(
      (p, i) =>
        `<article class="player ${i === 1 ? "jade" : ""} ${g.active === i && !g.finished ? "active" : ""}" aria-label="${e(p.name)}${g.active === i && !g.finished ? ", à vous de jouer" : ""}"><div class="crest" aria-hidden="true">${piece("king")}</div><div class="player-name"><h2>${e(p.name)}</h2></div><div class="resources">${Object.entries(
          RESOURCE_DEFINITIONS,
        )
          .map(
            ([id, r]) =>
              `<div class="resource" title="${e(r.name)}" aria-label="${p.resources[id] ?? 0} ${e(r.name)}"><em aria-hidden="true">${iconHTML(r.icon)}</em>${p.resources[id] ?? 0}<small>${e(r.name)}</small></div>`,
          )
          .join(
            "",
          )}</div><div class="player-score" title="Score actuel"><b>${totalScore(g, i)}</b><small>★</small></div></article>`,
    )
    .join("");
}

export function trainingView(g, position, b) {
  const [x, y] = parseKey(position);
  return BUILDINGS[b.type].trains
    .map((type) => {
      const unit = UNIT_DEFINITIONS[type],
        error = trainError(g, x, y, type);
      const payment = costPayment(g,unit.cost);
      return `<div class="training-option"><button class="train-unit secondary" data-action="train" data-type="${e(type)}" data-position="${position}" title="${e(error || `Recruter ${unit.name.toLowerCase()} · actif au prochain tour`)}" ${error ? "disabled" : ""}>+1 ${iconHTML(unit.icon)}<small>${costHTML(payment.resources)}</small></button></div>`;
    })
    .join("");
}
export function barracksView(g) {
  return Object.entries(g.board)
    .filter(
      ([, c]) =>
        c.building?.owner === g.active && BUILDINGS[c.building.type].trains,
    )
    .map(
      ([position, c]) =>
        `<div class="barracks-card"><strong>${e(BUILDINGS[c.building.type].name)} (${coordinates(...parseKey(position))})</strong>${trainingView(g, position, c.building)}</div>`,
    )
    .join("");
}

export function workersView(g) {
  return g.players[g.active].workerAssignments
    .filter((w) => !w.building)
    .map(
      (w) =>
        `<button class="free-worker worker-drag-handle ${g.active === 1 ? "jade" : ""}" data-worker-drag="${w.id}" aria-label="${e(UNIT_DEFINITIONS.worker.name)} ${w.id + 1} disponible" title="Glisser vers un bâtiment" ${g.finished ? "disabled" : ""}>${piece("worker")}</button>`,
    )
    .join("");
}
export function harvestView(g) {
  if (g.finished) return '<strong>Partie terminée · récolte finale effectuée</strong>';
  const { amounts, inactive } = harvestPreview(g);
  const gains = Object.entries(amounts).filter(([, n]) => n > 0)
    .map(([id, n]) => `+${n} ${e(RESOURCES[id].toLowerCase())}`).join(" · ");
  const free = g.players[g.active].workerAssignments.some(w => !w.building);
  return `<strong>Fin du tour : ${gains || "aucune récolte"}</strong>${inactive.length ? `<div class="inactive-list">${inactive.map(position => {
    const b = g.board[position].building;
    return `<span>${e(BUILDINGS[b.type].name)} (${coordinates(...parseKey(position))}) : sans ${e(UNIT_DEFINITIONS.worker.name.toLowerCase())} ${free ? `<button class="secondary" data-action="assign" data-position="${position}">Affecter un ${e(UNIT_DEFINITIONS.worker.name.toLowerCase())} libre</button>` : ""}</span>`;
  }).join("")}</div>` : ""}`;
}

export function terrainMarketView(g, ui) {
  return (
    (g.opening ? g.opening.tiles : g.tileMarket)
      .map((tile, i) => {
        const choice = ui.drag || ui.placement;
        const selected = choice?.kind === "terrain" && choice.index === i;
        return `<button class="tile-card ${selected ? "selected" : ""}" draggable="false" title="${e(tile.name)}${tile.intent ? " · " + e(tile.intent) : ""}" data-tile="${i}" aria-pressed="${selected}" aria-label="${e(tile.name || "Tuile terrain")}, ${tile.cells.length} cases" ${g.finished ? "disabled" : ""}>${terrainDiagram(tile, ui.rotation, RULES.markets.terrainSize >= 4 ? 48 : 64)}</button>`;
      })
      .join("") ||
    '<p class="empty-state">La pioche de terrains est épuisée.</p>'
  );
}
export function singleTerrainView(g, ui) {
  if (g.opening) return "";
  const unit = actor(g);
  const cost = RULES.trade.singleTerrainCost;
  const disabled = g.finished || unit.type === "soldier" || unit.acted || unit.ended || g.players[g.active].resources.gold < cost;
  return `<div class="single-terrain-label" title="Acheter une case de terrain pour ${cost} or">${cost} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)} → 1 case</div><div class="single-terrain-market" aria-label="Acheter une case de terrain pour ${cost} or">${["plain", "forest", "mountain", "river"].map(id => {
    const selected = (ui.drag || ui.placement)?.kind === "single-terrain" && (ui.drag || ui.placement).terrain === id;
    return `<button class="tile-card ${selected ? "selected" : ""}" data-single-terrain="${id}" draggable="false" aria-label="Acheter une case de ${e(TERRAINS[id].name.toLowerCase())} pour ${cost} or" aria-pressed="${selected}" title="${e(TERRAINS[id].name)} · ${cost} or" ${disabled ? "disabled" : ""}>${iconHTML(TERRAINS[id].icon)}</button>`;
  }).join("")}</div>`;
}
export function buildingMarketView(g, ui) {
  return (
    g.buildingMarket
      .map((type, i) => {
        const b = BUILDINGS[type],
          choice = ui.drag || ui.placement,
          selected = choice?.kind === "building" && choice.index === i;
        return `<div class="building-offer"><button class="building-card ${selected ? "selected" : ""}" draggable="false" title="Cliquer pour les placements · Glisser pour construire" data-building="${i}" aria-pressed="${selected}" ${g.opening ? "disabled" : ""}><span class="building-pattern-slot">${buildingDiagram(type, ui.buildingRotation)}</span><span class="building-info"><strong>${buildingStars(b)} ${e(b.name)}</strong><span class="building-effect">${buildingEffectHTML(b)}</span><span class="cost">${costHTML(b.cost)}${b.points ? `<span class="building-points">· ${b.points} ★</span>` : ""}</span></span></button><button class="secondary offer-details" data-building-details="${e(type)}" data-building-orientation="${ui.buildingRotation}" aria-haspopup="dialog" aria-label="Voir les détails de ${e(b.name)}" title="Voir les détails de ${e(b.name)}">i</button></div>`;
      })
      .join("") ||
    '<p class="empty-state">La pioche de bâtiments est épuisée.</p>'
  );
}
function buildingDescription(b) {
  return b.description;
}
function buildingEffectHTML(b) {
  const label = buildingDescription(b);
  let effect;
  if (b.grantsWorker) effect = `+${b.grantsWorker} ${iconHTML(UNIT_DEFINITIONS.worker.icon)}`;
  else if (b.produces) effect = `+${b.production} ${iconHTML(RESOURCE_DEFINITIONS[b.produces].icon)} / ${iconHTML("assets/textures/icon-hourglass.svg")}`;
  else if (b.boost) effect = `×${b.boost.multiplier} ${iconHTML(RESOURCE_DEFINITIONS[BUILDINGS[b.boost.target].produces].icon)}`;
  else if (b.trains) effect = `+1 ${iconHTML(UNIT_DEFINITIONS[b.trains[0]].icon)} · +${b.trainingLimit} / ${iconHTML("assets/textures/icon-hourglass.svg")}`;
  else if (b.onBuildUnit) effect = `+1 ${iconHTML(UNIT_DEFINITIONS[b.onBuildUnit].icon)} · max. 1`;
  else if (b.garrison) effect = `${iconHTML("assets/textures/icon-shield.svg")} ${b.garrison} + 1`;
  else if (b.transformTo) effect = `${iconHTML(TERRAINS.forest.icon)} → ${iconHTML(TERRAINS[b.transformTo].icon)} · +${b.onBuildGain.material} ${iconHTML(RESOURCE_DEFINITIONS.material.icon)}`;
  else if (b.traversable) effect = `${iconHTML(TERRAINS[b.terrain[0]].icon)} → ↔`;
  else if (b.id === "monument") effect = `★ ${b.points}`;
  else effect = e(label);
  return `<span title="${e(label)}" aria-label="${e(label)}">${effect}</span>`;
}
function buildingStars(b) {
  return `<span class="building-stars" aria-label="${b.tier} étoile${b.tier > 1 ? "s" : ""}">${b.tier ? "★".repeat(b.tier) : "☆"}</span>`;
}
export function buildingDetailsView(type, rotation = 0) {
  const b = BUILDINGS[type];
  if (!b) return "";
  const terrains = [...new Set(b.cells.flatMap(c => [...c.terrain, ...(c.transformTo ? [c.transformTo] : [])]))];
  const effect = b.id === "monument"
    ? `Pas d’effet. Valeur : ${b.points} point(s).`
    : `<strong>Effet :</strong> ${e(buildingDescription(b))} Valeur : ${b.points || 0} point(s).`;
  return `<div class="building-detail-heading">${buildingStars(b)}<h2 id="building-details-title">${e(b.name)}</h2></div><div class="building-detail-diagram">${buildingDiagram(type, rotation, true)}</div><p class="building-legend">${terrains.map(id => `<span><i style="background:${TERRAINS[id].color}">${iconHTML(TERRAINS[id].icon)}</i>${e(TERRAINS[id].name)}</span>`).join("")}</p><p>${e(b.pattern)}</p><p>${effect}</p><p><strong>${b.constructible === false ? "Disponibilité" : "Coût"} :</strong> ${b.constructible === false ? "Bâtiment de départ uniquement" : costHTML(b.cost)}</p>`;
}

export function selectionView(g, ui) {
  const armyControls = armyControlsView(g);
  if (!ui.selected) return armyControls;
  const pos = ui.selected,
    cell = g.board[key(pos.x, pos.y)],
    site = buildingAt(g, pos.x, pos.y),
    b = site?.building,
    unit = actor(g);
  let html = armyControls + (b ? `<div class="selected-building"><strong>${e(BUILDINGS[b.type].name)} · ${buildingEffectHTML(BUILDINGS[b.type])}</strong><button data-building-details="${e(b.type)}" data-building-orientation="${b.rotation || 0}" aria-haspopup="dialog" aria-label="Détails de ${e(BUILDINGS[b.type].name)}" class="secondary">ⓘ</button></div>` : "");
  if (cell?.flag) html += `<strong title="${cell.flag.owner === null ? "Neutre" : e(g.players[cell.flag.owner].name)}">${iconHTML("assets/textures/icon-flag.svg")} · ★ ${RULES.points.flag}</strong>`;
  if (g.finished) return html;
  if (attackPaths(g).has(key(pos.x,pos.y))) {
    const r = combatPreview(g,pos.x,pos.y);
    html += `<div class="combat-summary"><strong title="Attaque / défense">${iconHTML("assets/textures/icon-attack.svg")} ${r.attack} · ${iconHTML("assets/textures/icon-shield.svg")} ${r.defense}</strong><span title="Soldats survivants : attaquant / défenseur">→ ${iconHTML("assets/textures/units-soldier.svg")} ${r.attackerSurvivors} / ${Math.max(0,r.defenderSurvivors-r.garrison)}${r.garrison ? ` · ${iconHTML("assets/textures/icon-shield.svg")} ${r.attackerSurvivors ? "0" : "1"}` : ""}</span><button data-action="attack" class="primary">${cell?.flag && !r.defense ? "Capturer" : "Attaquer"}</button></div>`;
  }
  if (b?.owner === g.active && BUILDINGS[b.type].produces) {
    const assignedWorker = workersAt(g, g.active, site.x, site.y).length > 0,
      noFree =
        !assignedWorker && assigned(g, g.active) >= g.players[g.active].workers;
    html += `<button data-action="assign" data-position="${key(site.x, site.y)}" class="secondary" ${noFree ? "disabled" : ""}>${assignedWorker ? `Libérer ${e(UNIT_DEFINITIONS.worker.name.toLowerCase())}` : `Affecter un ${e(UNIT_DEFINITIONS.worker.name.toLowerCase())}`}</button>`;
    if (noFree)
      html +=
        `<small class="selection-reason">Tous vos ${e(UNIT_DEFINITIONS.worker.name.toLowerCase())} sont occupés. Réaffectez-en un depuis un autre bâtiment.</small>`;
  }
  if (b?.owner === g.active && BUILDINGS[b.type].trains)
    html += trainingView(g, key(site.x, site.y), b);
  if (
    cell &&
    (pos.x !== unit.x || pos.y !== unit.y) &&
    !moveError(g, pos.x, pos.y)
  )
    html +=
      '<button data-action="move" class="primary">Aller sur cette case</button>';
  const occupants = g.players[g.active].units.filter(
    (u) => u.x === pos.x && u.y === pos.y && u.id !== g.selectedUnitId,
  );
  for (const u of occupants)
    html += `<button data-unit="${u.id}" class="secondary">Contrôler ${e(UNIT_DEFINITIONS[u.type].name)} ${u.id + 1}</button>`;
  return html;
}

export function resultsView(g) {
  return g.players
    .map(
      (p, i) =>
        `<div class="result-card"><h3>${e(p.name)}</h3>${Object.entries(
          score(g, i),
        )
          .map(
            ([id, n]) =>
              `<p><span>${{ flags: "Drapeaux", buildings: "Bâtiments", gold: `Or (${RULES.points.goldPerPoint} = 1 ★)` }[id]}</span><strong>${n}</strong></p>`,
          )
          .join(
            "",
          )}<p class="result-total"><span>Total</span><strong>${totalScore(g, i)}</strong></p></div>`,
    )
    .join("");
}
export function armyControlsView(g) {
  const unit = actor(g);
  if (unit.type !== "soldier" || g.finished) return "";
  const total = armyAt(g,g.active,unit.x,unit.y), ready = total.filter(u => !u.acted && !u.ended);
  return `<div class="army-controls"><strong>${iconHTML(UNIT_DEFINITIONS.soldier.icon)} ${total.length} · ${ready.length} disponible(s)</strong>${ready.length ? `<label>Effectif <select data-army-size aria-label="Effectif de la pile sélectionnée">${ready.map((_,i) => `<option value="${i+1}" ${selectedSoldiers(g).length === i+1 ? "selected" : ""}>${i+1}</option>`).join("")}</select></label>` : "<span>Activation terminée</span>"}</div>`;
}
export function tradeView(g) {
  return `<span title="Achat des ressources manquantes : prix de base ${RULES.trade.basePrice} + ${RULES.trade.producerSurcharge} par producteur adverse"><strong>Banque</strong> · ${tradePrice(g,"food")} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)} → ${iconHTML(RESOURCE_DEFINITIONS.food.icon)} · ${tradePrice(g,"material")} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)} → ${iconHTML(RESOURCE_DEFINITIONS.material.icon)}</span>`;
}
export function rulesView(g) {
  const size = g?.boardSize ?? GAME_DEFAULTS.boardSize,
    rounds = g?.turnLimit ?? GAME_DEFAULTS.rounds,
    openingCount = g?.openingTilesPerPlayer ?? GAME_DEFAULTS.openingTilesPerPlayer;
  return `<h3>1. Le but</h3>
  <p>Conquérez le donjon adverse avec une armée survivante pour gagner immédiatement. Sinon, après ${rounds} tours par joueur, le meilleur score gagne : points des bâtiments + ${RULES.points.flag} par drapeau + 1 par groupe de ${RULES.points.goldPerPoint} ors.</p>
  <h3>2. Préparer le plateau</h3>
  <p>Sur le plateau ${size} × ${size}, chacun place ${openingCount} tuile(s) de préparation sur des cases libres, en alternance. À deux, Jade commence. Ces poses ne comptent pas pour les missions.</p>
  <h3>3. Jouer son tour</h3>
  <p>Chaque unité dispose de ${UNIT_DEFINITIONS.king.moves} déplacements par les bords, puis d’une action. Le roi et l’émissaire ne peuvent plus se déplacer après avoir exploré ou construit. Le roi et l’émissaire explorent ou construisent ; les soldats combattent. Cliquez sur « Fin de tour » pour récolter et passer la main.</p>
  <h3>4. Explorer et construire</h3>
  <p>Posez une tuile terrain au contact du bâtisseur : elle révèle des cases communes aux deux joueurs. Pour ${RULES.trade.singleTerrainCost} or, vous pouvez aussi révéler une seule case voisine du terrain choisi. Cela consomme l’action.</p>
  <p>Pour construire, payez le coût et placez l’entrée sur la case du bâtisseur ou une case voisine. Le motif doit respecter les terrains révélés et ne pas recouvrir un bâtiment. Montagnes et rivières nécessitent un tunnel ou un pont pour être traversées. Consultez le catalogue pour les motifs et effets.</p>
  <h3>5. Produire et progresser</h3>
  <p>Une maison fournit un ouvrier. Affectez-le gratuitement à un producteur : un ouvrier par bâtiment, récolte en fin de tour. Les missions rapportent de l’or. Les ressources manquantes peuvent être achetées en or lors d’une construction ou d’un recrutement ; le tarif figure dans la banque.</p>
  <p>Une relance du marché coûte ${GOLD.rerollCost} or, une fois par tour. Les unités recrutées deviennent actives à votre prochain tour.</p>
  <h3>6. Combattre et conquérir</h3>
  <p>Regroupez vos soldats ou choisissez un effectif pour diviser l’armée. Attaque : nombre de soldats. Défense : soldats et garnison, avec un bonus de 1 si la cible est défendue. Le camp le plus fort conserve la différence ; à égalité, aucun attaquant ne peut occuper la cible.</p>
  <p>Avec un survivant, occupez un drapeau pour le capturer ou un bâtiment adverse pour le détruire. Les drapeaux restent acquis après votre départ. Les garnisons restent jusqu’à une occupation ennemie. Un roi ou émissaire capturé revient à son bâtiment d’origine et ne peut pas agir au tour suivant. Si la Chancellerie a été détruite, l’émissaire revient au donjon.</p>
  <h3>7. Manipuler les pièces</h3>
  <p>Cliquez ou glissez les unités et les cartes. R ou la molette pivote une tuile ; Échap ou clic droit annule la sélection.</p>`;
}

export function missionsView(g) {
  return (
    g.missions.market
      .map((id) => {
        const m = MISSIONS[id];
        const symbol = m.metric === "built" ? iconHTML(BUILDINGS[m.building]?.icon || "assets/textures/buildings-house.svg")
          : m.metric === "revealed" ? iconHTML(TERRAINS[m.terrain]?.icon || "assets/textures/icon-terrain.svg")
          : m.metric === "recruited" ? iconHTML(UNIT_DEFINITIONS.worker.icon)
          : m.resource ? iconHTML(RESOURCE_DEFINITIONS[m.resource].icon) : "Σ";
        const label = {built:"Bâtir",revealed:"Explorer",recruited:"Recruter",resources:"Stock"}[m.metric];
        return `<article class="mission-card" title="${e(m.name)} · premier arrivé, premier servi" aria-label="${e(m.name)}"><div><strong><span class="mission-stars" aria-label="Difficulté ${m.difficulty} sur ${RULES.missionRules.maxDifficulty}">${"★".repeat(m.difficulty)}</span>${label} ${symbol} ${m.target}</strong><b>+${m.reward.gold} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)}</b></div><div class="mission-progress">${g.players
          .map((p, i) => {
            const progress = missionProgress(g, id, i), target = missionTarget(g, id, i);
            return `<span class="${i === 1 ? "jade" : "amber"}" title="${target > m.target ? `+${RULES.missionRules.requiredContribution} contribution requise` : e(p.name)}" aria-label="${e(p.name)} : ${progress} sur ${target}">${Math.min(target, progress)}/${target}</span>`;
          })
          .join("")}</div></article>`;
      })
      .join("") ||
    '<span class="missions-empty">Plus de missions disponibles.</span>'
  );
}
