import { iconHTML } from "./html.js";
import { piece } from "./pieces.js";
import {
  RULES,
  PRESTIGE,
  MISSIONS,
  missionProgress,
  missionTarget,
  harvestPreview,
  TERRAINS,
  RESOURCES,
  RESOURCE_DEFINITIONS,
  BUILDINGS,
  UNIT_DEFINITIONS,
  RECRUITMENT_COST,
  actor,
  population,
  housing,
  totalScore,
  score,
  assigned,
  workersAt,
  productionAmount,
  buildingAt,
  moveError,
  trainError,
} from "../engine.js";
import { key, parseKey } from "../geometry.js";
import {
  e,
  costHTML,
  costText,
  populationHTML,
  coordinates,
  terrainDiagram,
  buildingDiagram,
} from "./html.js";

export function playersView(g) {
  return g.players
    .map(
      (p, i) =>
        `<article class="player ${i === 1 ? "jade" : ""} ${g.active === i && !g.finished ? "active" : ""}" aria-label="${e(p.name)}${g.active === i && !g.finished ? ", à vous de jouer" : ""}"><div class="crest" aria-hidden="true">${piece("king")}</div><div class="player-name"><h2>${e(p.name)}</h2></div><div class="resources">${Object.entries(
          RESOURCE_DEFINITIONS,
        )
          .map(
            ([id, r]) =>
              `<div class="resource" title="${e(r.name)}" aria-label="${r.calculated === "population" ? `${population(g, i)}/${housing(g, i)}` : p.resources[id] ?? 0} ${e(r.name)}"><em aria-hidden="true">${iconHTML(r.icon)}</em>${r.calculated === "population" ? `${population(g, i)}/${housing(g, i)}` : p.resources[id] ?? 0}<small>${e(r.name)}</small></div>`,
          )
          .join(
            "",
          )}<div class="prestige-count" title="Prestige : ${RULES.points.prestige} points par prestige" aria-label="${p.prestige} prestige">✦ ${p.prestige}</div></div><div class="player-score" title="Score actuel"><b>${totalScore(g, i)}</b><small>★</small></div></article>`,
    )
    .join("");
}

export function trainingView(g, position, b) {
  const [x, y] = parseKey(position);
  return BUILDINGS[b.type].trains
    .map((type) => {
      const unit = UNIT_DEFINITIONS[type],
        error = trainError(g, x, y, type);
      return `<div class="training-option"><button class="train-unit secondary" data-action="train" data-type="${e(type)}" data-position="${position}" ${error ? "disabled" : ""}>${iconHTML(unit.icon)} ${e(unit.name)}<small>${costHTML(unit.cost)} · ${populationHTML(unit.population)}</small></button>${error ? `<small class="disabled-reason">${e(error)}</small>` : ""}</div>`;
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
    g.tileMarket
      .map((tile, i) => {
        const choice = ui.drag || ui.placement;
        const selected = choice?.kind === "terrain" && choice.index === i;
        return `<button class="tile-card ${selected ? "selected" : ""}" draggable="false" title="${e(tile.name)}${tile.intent ? " · " + e(tile.intent) : ""}" data-tile="${i}" aria-pressed="${selected}" aria-label="${e(tile.name || "Tuile terrain")}, ${tile.cells.length} cases" ${g.finished ? "disabled" : ""}>${terrainDiagram(tile, ui.rotation)}</button>`;
      })
      .join("") ||
    '<p class="empty-state">La pioche de terrains est épuisée.</p>'
  );
}
export function buildingMarketView(g, ui) {
  return (
    g.buildingMarket
      .map((type, i) => {
        const b = BUILDINGS[type],
          choice = ui.drag || ui.placement,
          selected = choice?.kind === "building" && choice.index === i;
        return `<div class="building-offer"><button class="building-card ${selected ? "selected" : ""}" draggable="false" title="Cliquer pour les placements · Glisser pour construire" data-building="${i}" aria-pressed="${selected}">${buildingDiagram(type, ui.buildingRotation)}<span class="building-info"><strong>${buildingStars(b)} ${e(b.name)}</strong><span class="building-effect">${buildingEffectHTML(b)}</span><span class="cost">${costHTML(b.cost)}</span></span></button><button class="secondary offer-details" data-building-details="${e(type)}" data-building-orientation="${ui.buildingRotation}" aria-haspopup="dialog" aria-label="Voir les détails de ${e(b.name)}" title="Voir les détails de ${e(b.name)}">i</button></div>`;
      })
      .join("") ||
    '<p class="empty-state">La pioche de bâtiments est épuisée.</p>'
  );
}
function buildingDescription(b) {
  if (b.housing) return `${b.housing} places pour la population.`;
  if (b.produces) return `${b.production} ${RESOURCES[b.produces].toLowerCase()} par tour avec un ${UNIT_DEFINITIONS.worker.name.toLowerCase()}.`;
  return b.description;
}
function buildingEffectHTML(b) {
  const label = buildingDescription(b);
  let effect;
  if (b.housing) effect = `+${b.housing} ${iconHTML(RESOURCE_DEFINITIONS.population.icon)}`;
  else if (b.produces) effect = `+${b.production} ${iconHTML(RESOURCE_DEFINITIONS[b.produces].icon)} / ${iconHTML("assets/textures/icon-hourglass.svg")}`;
  else if (b.boost) effect = `×${b.boost.multiplier} ${iconHTML(RESOURCE_DEFINITIONS[BUILDINGS[b.boost.target].produces].icon)} des fermes voisines`;
  else if (b.trains) effect = `${iconHTML(UNIT_DEFINITIONS[b.trains[0]].icon)} ×${b.trainingLimit} / ${iconHTML("assets/textures/icon-hourglass.svg")}`;
  else if (b.transformTo) effect = `${iconHTML(TERRAINS.forest.icon)} → ${iconHTML(TERRAINS[b.transformTo].icon)} · +${b.onBuildGain.wood} ${iconHTML(RESOURCE_DEFINITIONS.wood.icon)}`;
  else if (b.traversable) effect = `${iconHTML(TERRAINS.river.icon)} traversable`;
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
  return `<div class="building-detail-heading">${buildingStars(b)}<h2 id="building-details-title">${e(b.name)}</h2></div><div class="building-detail-diagram">${buildingDiagram(type, rotation, true)}</div><p class="building-legend">${terrains.map(id => `<span><i style="background:${TERRAINS[id].color}">${iconHTML(TERRAINS[id].icon)}</i>${e(TERRAINS[id].name)}</span>`).join("")}</p><p>${e(b.pattern)}</p><p><strong>Effet :</strong> ${e(buildingDescription(b))}</p><p><strong>${b.constructible === false ? "Disponibilité" : "Coût"} :</strong> ${b.constructible === false ? "Bâtiment de départ uniquement" : costHTML(b.cost)}</p><p class="building-placement-help">${b.constructible === false ? `${e(b.name)} accueille ${b.housing || 0} places de population.` : `Le symbole marque l’entrée : placez-la à ${RULES.placement.constructionRange} case(s) maximum de l’unité, sans diagonale. Le motif peut pivoter ; toutes ses cases doivent être libres et respecter les terrains indiqués.`}</p>`;
}

export function selectionView(g, ui) {
  if (!ui.selected) return "";
  const pos = ui.selected,
    cell = g.board[key(pos.x, pos.y)],
    site = buildingAt(g, pos.x, pos.y),
    b = site?.building,
    unit = actor(g);
  let html = b ? `<div class="selected-building"><strong>${buildingStars(BUILDINGS[b.type])} ${e(BUILDINGS[b.type].name)}</strong><span>${e(BUILDINGS[b.type].description)}</span><button data-building-details="${e(b.type)}" data-building-orientation="${b.rotation || 0}" aria-haspopup="dialog" class="secondary">Voir le motif et les détails</button></div>` : "";
  if (g.finished) return html;
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
              `<p><span>${{ tiles: "Cases révélées", buildings: "Bâtiments", workers: UNIT_DEFINITIONS.worker.name, units: "Unités", prestige: "Prestige", resources: "Ressources" }[id]}</span><strong>${n}</strong></p>`,
          )
          .join(
            "",
          )}<p class="result-total"><span>Total</span><strong>${totalScore(g, i)}</strong></p></div>`,
    )
    .join("");
}
export function rulesView() {
  const worker = UNIT_DEFINITIONS.worker, king = UNIT_DEFINITIONS.king;
  const start = BUILDINGS[RULES.startingBuilding];
  return `<h3>Le tour de jeu</h3><p>Le ${e(king.name.toLowerCase())} possède ${king.moves} déplacements et une action au choix : explorer ou construire. Déplacez l’unité avant son action. Une action termine son activation et les déplacements restants. Les déplacements se font de case en case par un bord ; les unités adverses bloquent le passage.</p>
  <h3>Explorer et construire</h3><p>Cliquez une carte pour afficher ses placements possibles en vert, puis cliquez une case verte, ou glissez la carte sur le plateau. R pivote la carte ; Échap annule. Le survol ou le focus explique les refus. Une case explorée doit être à ${RULES.placement.explorationContactDistance} case(s) de l’unité, sans diagonale. Pour construire, l’entrée doit être à ${RULES.placement.constructionRange} case(s) maximum de l’unité ; toutes les cases du motif doivent être explorées, libres et respecter les terrains indiqués. Les terrains infranchissables sont : ${Object.values(TERRAINS).filter(t => !t.walkable).map(t => e(t.name)).join(", ") || "aucun"}, sauf sur un bâtiment traversable.</p>
  <h3>Marchés</h3><p>${RULES.markets.terrainSize} terrains et ${RULES.markets.buildingSize} bâtiments sont proposés. Le marché initial est limité au tier ${RULES.markets.initialMaxTier}. Les tiers supérieurs deviennent éligibles au remplacement numéro ${RULES.markets.advancedFromReplacement}. Le compteur est partagé ; une relance du marché bâtiments compte comme un remplacement, une relance de terrains ne compte pas. Une relance coûte ${PRESTIGE.rerollCost} prestige, sans action, avec une limite de ${PRESTIGE.rerollLimitPerTurn} par tour.</p>
  <h3>Population et recrutement</h3><p>Vous pouvez recruter ${RULES.workerRecruitmentLimitPerTurn} ${e(worker.name.toLowerCase())} par tour pour ${e(costText(worker.cost))} chacun, avec ${worker.population} place(s) libre(s) dans vos logements. L’affectation aux producteurs est immédiate et gratuite ; les affectations finales déterminent la récolte de fin de tour. Le ${e(king.name.toLowerCase())} consomme ${king.population} place(s) de population et est fourni au départ.</p>
  <h3>Unités</h3>${Object.values(UNIT_DEFINITIONS).map(u => `<p><strong>${e(u.name)}</strong> : ${u.population} population, ${u.moves} déplacements, ${u.points * RULES.points.unit} point(s). ${u.recruitment === "building" ? `Coût : ${e(costText(u.cost))}. Le bâtiment formateur fixe le quota ; l’unité est active au prochain tour.` : u.recruitment === "initial" ? "Unité initiale, sans recrutement." : "Recrutement direct, sans déplacement ; affectation aux producteurs."}</p>`).join("")}
  <h3>Bâtiments</h3>${Object.values(BUILDINGS).map(b => `<p><strong>${e(b.name)}</strong> — ${e(costText(b.cost))}. ${e(b.pattern)} ${e(buildingDescription(b))}</p>`).join("")}
  <h3>Missions et prestige</h3><p>${RULES.missionMarketSize} missions sont proposées au niveau ${RULES.missionRules.initialDifficulty}. Chaque objectif remporté est remplacé par un objectif du niveau suivant, jusqu’au niveau ${RULES.missionRules.maxDifficulty}. Chaque joueur doit atteindre le plus grand entre le seuil indiqué et sa progression à l’apparition plus ${RULES.missionRules.requiredContribution}. Les stocks sont les quantités détenues ; les autres compteurs sont cumulés. Les éléments initiaux sont exclus. Les récompenses figurent sur chaque mission. Le prestige initial vaut ${PRESTIGE.firstPlayerStartingAmount} pour le premier joueur et ${PRESTIGE.startingAmount} pour les suivants. Une ressource manquante à la construction peut être remplacée par ${PRESTIGE.wildcardCost} prestige après confirmation.</p>
  <h3>Départ et score</h3><p>Plateau ${RULES.size} × ${RULES.size}, ${RULES.rounds} tours par joueur. Départ : un ${e(king.name.toLowerCase())}, ${RULES.startingWorkers} ${e(worker.name.toLowerCase())}, ${e(start.name)} (${start.housing || 0} places) et ${e(costText(RULES.startResources))}. Le score compte ${RULES.points.tile} point(s) par case révélée, ${RULES.points.building} par bâtiment, les points des unités multipliés par ${RULES.points.unit}, et ${RULES.points.prestige} par prestige restant. Les stocks pondérés par la valeur de chaque ressource sont multipliés par ${RULES.points.resource}, puis arrondis à l’entier inférieur. Une égalité donne une victoire partagée.</p>`;
}

export function missionsView(g) {
  return (
    g.missions.market
      .map((id) => {
        const m = MISSIONS[id];
        return `<article class="mission-card" title="Premier arrivé, premier servi"><div><strong><span class="mission-stars" aria-label="Difficulté ${m.difficulty} sur ${RULES.missionRules.maxDifficulty}">${"★".repeat(m.difficulty)}</span>${e(m.name)}</strong><b>+${m.reward.prestige} ✦</b></div><div class="mission-progress">${g.players
          .map((p, i) => {
            const progress = missionProgress(g, id, i), target = missionTarget(g, id, i);
            return `<span class="${i === 1 ? "jade" : "amber"}" aria-label="${e(p.name)} : ${progress} sur ${target}">${Math.min(target, progress)}/${target}${target > m.target ? ` · +${RULES.missionRules.requiredContribution} contribution requise` : ""}</span>`;
          })
          .join("")}</div></article>`;
      })
      .join("") ||
    '<span class="missions-empty">Plus de missions disponibles.</span>'
  );
}
