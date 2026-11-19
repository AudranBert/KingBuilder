import { iconHTML } from "./html.js";
import { piece } from "./pieces.js";
import {
  RULES,
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
  return `<span title="Achat des ressources manquantes : prix de base ${RULES.trade.basePrice} + ${RULES.trade.producerSurcharge} par producteur adverse"><strong>Banque</strong> · ${iconHTML(RESOURCE_DEFINITIONS.food.icon)} → ${tradePrice(g,"food")} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)} · ${iconHTML(RESOURCE_DEFINITIONS.material.icon)} → ${tradePrice(g,"material")} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)}</span>`;
}
export function rulesView() {
  return `<h3>Deux façons de gagner</h3><p>Plateau ${RULES.size} × ${RULES.size}. Occuper le donjon adverse avec une armée survivante donne une victoire immédiate. Sinon, après ${RULES.rounds} tours par joueur, les bâtiments, les drapeaux et l’or restant départagent les royaumes. Chaque drapeau vaut ${RULES.points.flag} points ; chaque groupe de ${RULES.points.goldPerPoint} ors restants vaut 1 point. Les ouvriers, les unités, la nourriture, les matériaux et l’exploration ne donnent pas de points. Égalité : victoire partagée.</p>
  <h3>Préparation</h3><p>Avant le tour 1, cinq tuiles terrain de 5 ou 6 cases sont proposées. Chacun en place deux sur des cases libres, dans l’ordre Jade → Ambre → Jade → Ambre. Une tuile posée quitte le choix commun ; les poses ne consomment pas d’action et ne comptent pas pour les missions. En solo, placez deux tuiles.</p>
  <h3>Commandes</h3><p>Un clic droit efface la sélection. ↶ annule uniquement la dernière action ; le bouton se désactive ensuite et l’annulation ne passe pas d’un tour à l’autre.</p>
  <h3>Explorer et construire</h3><p>Le roi et l’émissaire disposent de 3 déplacements orthogonaux puis d’une action : explorer ou construire. L’action termine leur activation. Les terrains révélés sont communs. Sélectionnez ou glissez une carte ; R ou la molette la fait pivoter. Pour ${RULES.trade.singleTerrainCost} or, choisissez directement une case de plaine, forêt, montagne ou rivière voisine de l’unité : cette pose utilise son action. L’entrée d’un bâtiment doit être à une case maximum du bâtisseur. Son motif doit être révélé et respecter les terrains ; les annexes compatibles peuvent se chevaucher, mais les cases des bâtiments ne se chevauchent jamais.</p>
  <h3>Économie et ouvriers</h3><p>Une maison coûte 2 nourritures et 2 matériaux et donne immédiatement un ouvrier, affectable sans trajet ni coût. Un ouvrier par producteur ; récolte en fin de tour. Ferme : nourriture ; scierie et carrière : matériaux ; mine et port : or. Un moulin sur plaine ou champ doit toucher un champ allié et double la nourriture de cette ferme, sans cumul. Aucun logement ni recrutement séparé d’ouvrier.</p>
  <h3>Banque et missions</h3><p>Pour construire ou recruter, achetez les ressources manquantes à la banque en or. Une ressource coûte ${RULES.trade.basePrice} ors plus ${RULES.trade.producerSurcharge} par bâtiment adverse qui peut la produire, même sans ouvrier. L’or ne s’achète pas. Les missions donnent de l’or ; renouveler un marché coûte ${GOLD.rerollCost} or, une fois par tour. L’or remplace entièrement le prestige.</p>
  <h3>Soldats et armées</h3><p>Une caserne fournit un premier soldat gratuit et permet un recrutement payant par tour. Chaque nouvelle unité apparaît sur son bâtiment et reste grisée jusqu’au prochain tour. Les soldats sur une même case forment une pile ; choisissez son effectif pour la diviser. Chaque pion conserve ses déplacements et son activation après une fusion. Une armée possède 3 déplacements puis une action de combat ; elle n’explore pas et ne construit pas.</p>
  <h3>Combat et occupation</h3><p>Attaque = nombre de soldats ; défense = nombre de soldats + 1. Le vainqueur conserve la différence des forces. À égalité, les armées sont éliminées. 7 contre 5 : 1 attaquant survit ; 5 contre 5 : 1 défenseur survit. L’occupation d’une cible sans défense consomme aussi l’action. Le résultat est annoncé avant confirmation.</p>
  <h3>Drapeaux, garnisons et destruction</h3><p>Les cinq drapeaux sont révélés au départ. Une armée doit occuper leur case pour les capturer ; ils gardent leur couleur après son départ. Un avant-poste peut être construit sur toute case révélée libre, quel que soit son terrain. Sur un drapeau, il en prend le contrôle. Sa case devient praticable. Avant-poste et donjon disposent d’un soldat fixe, renforçable par une armée, avec un seul bonus défensif +1. La garnison persiste jusqu’à une occupation ennemie avec au moins un survivant, même après une égalité.</p><p>Occuper la case réelle d’un bâtiment ennemi le détruit ; ses terrains annexes ne sont pas des cibles. Toute l’empreinte est libérée et ses terrains restent révélés. L’ouvrier retourne dans sa réserve. Le roi capturé retourne au donjon ; l’émissaire retourne à sa Chancellerie, ou au donjon si elle a disparu. Ils perdent leur prochain tour d’activation.</p>
  <h3>Émissaire du roi</h3><p>Une Chancellerie coûteuse fournit une seconde unité d’exploration et de construction. Un émissaire et une Chancellerie maximum par royaume. L’émissaire ne combat pas et ne contrôle pas les drapeaux.</p>
  <h3>Bâtiments</h3>${Object.values(BUILDINGS).map(b => `<p><strong>${e(b.name)}</strong> — ${e(costText(b.cost))}. ${e(b.pattern)} ${e(buildingDescription(b))} ${b.points || 0} point(s).</p>`).join("")}`;
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
