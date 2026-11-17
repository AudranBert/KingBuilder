import { piece } from "./pieces.js";
import {
  RULES,
  PRESTIGE,
  MISSIONS,
  missionProgress,
  buildingPayment,
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
  buildError,
  exploreError,
  moveError,
  trainError,
  recruitError,
} from "../engine.js";
import { key } from "../geometry.js";
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
        `<article class="player ${i === 1 ? "jade" : ""} ${g.active === i && !g.finished ? "active" : ""}" aria-label="${e(p.name)}${g.active === i && !g.finished ? ", à vous de jouer" : ""}"><div class="crest" aria-hidden="true">${piece("king")}</div><div class="player-name"><h2>${e(p.name)}</h2><small>${population(g, i)}/${housing(g, i)} population</small></div><div class="resources">${Object.entries(
          RESOURCE_DEFINITIONS,
        )
          .map(
            ([id, r]) =>
              `<div class="resource" title="${e(r.name)}" aria-label="${p.resources[id] ?? 0} ${e(r.name)}"><em aria-hidden="true">${e(r.icon)}</em>${p.resources[id] ?? 0}<small>${e(r.name)}</small></div>`,
          )
          .join(
            "",
          )}<div class="prestige-count" title="Prestige : ${RULES.points.prestige} points par prestige" aria-label="${p.prestige} prestige">✦ ${p.prestige}</div></div><div class="player-score" title="Score actuel"><b>${totalScore(g, i)}</b><small>★</small></div></article>`,
    )
    .join("");
}

export function unitOptions(g) {
  return (
    `<option value="">Roi · ${g.moves} pas${g.acted || g.kingEnded ? " · action terminée" : ""}</option>` +
    g.players[g.active].units
      .map(
        (u) =>
          `<option value="${u.id}">${e(UNIT_DEFINITIONS[u.type].name)} ${u.id + 1} · ${u.moves} pas${u.acted || u.ended ? " · action terminée" : ""}</option>`,
      )
      .join("")
  );
}
export function unitListView(g) {
  return (
    `<button class="unit-card ${g.selectedUnitId === null ? "selected" : ""}" data-unit="" aria-pressed="${g.selectedUnitId === null}" ${g.finished ? "disabled" : ""}>${piece("king")} Roi<small>${g.moves} pas · ${g.acted || g.kingEnded ? "action terminée" : "action disponible"}</small></button>` +
    g.players[g.active].units
      .map(
        (u) =>
          `<button class="unit-card ${g.selectedUnitId === u.id ? "selected" : ""}" data-unit="${u.id}" aria-pressed="${g.selectedUnitId === u.id}" ${g.finished ? "disabled" : ""}>${piece(u.type)} ${e(UNIT_DEFINITIONS[u.type].name)} ${u.id + 1}<small>${coordinates(u.x, u.y)} · ${u.moves} pas · ${u.acted || u.ended ? "action terminée" : "action disponible"}</small></button>`,
      )
      .join("")
  );
}

export function trainingView(g, position, b) {
  return BUILDINGS[b.type].trains
    .map((type) => {
      const [x, y] = position.split(",").map(Number),
        unit = UNIT_DEFINITIONS[type],
        error = trainError(g, x, y, type);
      return `<div class="training-option"><button class="train-unit secondary" data-action="train" data-type="${e(type)}" data-position="${position}" ${error ? "disabled" : ""}>${e(unit.icon)} ${e(unit.name)}<small>${costHTML(unit.cost)} · ${unit.population} population</small></button>${error ? `<small class="disabled-reason">${e(error)}</small>` : ""}</div>`;
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
        `<div class="barracks-card"><strong>${e(BUILDINGS[c.building.type].name)} (${position
          .split(",")
          .map((n) => +n + 1)
          .join(", ")})</strong>${trainingView(g, position, c.building)}</div>`,
    )
    .join("");
}

export function workersView(g) {
  return g.players[g.active].workerAssignments
    .filter((w) => !w.building)
    .map(
      (w) =>
        `<button class="free-worker worker-drag-handle ${g.active === 1 ? "jade" : ""}" data-worker-drag="${w.id}" aria-label="Ouvrier ${w.id + 1} disponible" title="Glisser vers un bâtiment" ${g.finished ? "disabled" : ""}>${piece("worker")}</button>`,
    )
    .join("");
}

export function terrainMarketView(g, ui) {
  return (
    g.tileMarket
      .map((tile, i) => {
        const selected = i === ui.tileIndex && ui.buildingIndex === null;
        return `<button class="tile-card ${selected ? "selected" : ""}" draggable="false" title="${e(tile.name)}${tile.intent ? " · " + e(tile.intent) : ""}" data-tile="${i}" aria-pressed="${selected}" aria-label="${e(tile.name || "Tuile terrain")}, ${tile.cells.length} cases" ${g.finished ? "disabled" : ""}>${terrainDiagram(tile, selected ? ui.rotation : 0, selected ? ui.anchor : undefined)}</button>`;
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
          selected = ui.buildingIndex === i;
        return `<button class="building-card ${selected ? "selected" : ""}" draggable="false" title="${e(b.description)} ${e(b.pattern)}" data-building="${i}" aria-pressed="${selected}" ${g.finished ? "disabled" : ""}>${buildingDiagram(type, selected ? ui.buildingRotation : 0)}<span class="building-info"><strong>${e(b.name)}</strong></span><span class="cost">${costHTML(b.cost)}</span></button>`;
      })
      .join("") ||
    '<p class="empty-state">La pioche de bâtiments est épuisée.</p>'
  );
}

export function selectionView(g, ui) {
  if (!ui.selected && ui.buildingIndex === null && !ui.exploreTarget) return "";
  const pos = ui.selected || actor(g),
    cell = g.board[key(pos.x, pos.y)],
    site = buildingAt(g, pos.x, pos.y),
    b = site?.building,
    unit = actor(g);
  let html =
    ui.selected && b ? `<strong>${e(BUILDINGS[b.type].name)}</strong>` : "";
  if (g.finished) return html;
  if (ui.buildingIndex !== null) {
    const error = buildError(
      g,
      ui.buildingIndex,
      pos.x,
      pos.y,
      ui.buildingRotation,
      { allowPrestige: true },
    );
    const payment = buildingPayment(g, ui.buildingIndex);
    html += `<button data-action="build" id="build-confirm" class="primary" ${error ? "disabled" : ""}>${BUILDINGS[g.buildingMarket[ui.buildingIndex]].transformTo ? "Transformer" : "Construire"}${payment?.prestige ? ` · ${payment.prestige} ✦` : ""}</button><button data-action="cancel" class="secondary">Annuler</button>${error ? `<small class="selection-reason">${e(error)}</small>` : ""}`;
    return html;
  }
  if (ui.exploreTarget) {
    const error = exploreError(
      g,
      ui.tileIndex,
      pos.x,
      pos.y,
      ui.rotation,
      ui.anchor,
    );
    html += `<button data-action="explore" id="explore-confirm" class="primary" ${error ? "disabled" : ""}>Explorer · ${g.tileMarket[ui.tileIndex]?.cells.length ?? 0} cases</button><button data-action="cancel" class="secondary">Annuler</button><small class="selection-reason">${e(error || "")}</small>`;
    return html;
  }
  if (b?.owner === g.active && BUILDINGS[b.type].produces) {
    const assignedWorker = workersAt(g, g.active, site.x, site.y).length > 0,
      noFree =
        !assignedWorker && assigned(g, g.active) >= g.players[g.active].workers;
    html += `<button data-action="assign" data-position="${key(site.x, site.y)}" class="secondary" ${noFree ? "disabled" : ""}>${assignedWorker ? "Libérer l’ouvrier" : "Affecter un ouvrier"}</button>`;
    if (noFree)
      html +=
        '<small class="selection-reason">Tous vos ouvriers sont occupés. Glissez un ouvrier depuis un autre bâtiment.</small>';
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

export function turnView(g, ui) {
  const u = actor(g),
    recruitReason = recruitError(g);
  return {
    instruction: g.finished
      ? "La partie est terminée. Consultez le détail des scores."
      : ui.buildingIndex !== null
        ? "Choisissez l’entrée du bâtiment, puis confirmez sa construction."
        : ui.exploreTarget
          ? "Ajustez le motif sur la carte, puis confirmez l’exploration."
          : u.ended || u.acted
            ? `${u.name} a terminé ses actions. Sélectionnez une autre unité ou gérez vos ouvriers.`
            : `${u.name} · ${u.moves} pas restant(s). Cliquez une case voisine pour avancer ou préparer une exploration.`,
    chips: `<span class="action-chip">${e(u.icon)} ${e(u.name)}</span><span class="action-chip">${u.moves} pas</span><span class="action-chip">${u.acted || u.ended ? "Action terminée" : "1 exploration ou construction"}</span>`,
    recruitReason,
  };
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
              `<p><span>${{ tiles: "Cases révélées", buildings: "Bâtiments", workers: "Ouvriers", units: "Unités", prestige: "Prestige", resources: "Ressources" }[id]}</span><strong>${n}</strong></p>`,
          )
          .join(
            "",
          )}<p class="result-total"><span>Total</span><strong>${totalScore(g, i)}</strong></p></div>`,
    )
    .join("");
}
export function rulesView() {
  return `<h3>Prestige et missions</h3><p>Le premier joueur commence avec ${PRESTIGE.firstPlayerStartingAmount} prestige, le second avec ${PRESTIGE.startingAmount}. Chaque prestige restant vaut ${RULES.points.prestige} points en fin de partie. Trois missions sont communes : la première personne à atteindre un objectif visible remporte sa récompense, et une nouvelle mission est révélée. Les cases de départ, la maison et l’ouvrier initiaux ne comptent pas. Les stocks correspondent aux ressources détenues au moment de la vérification ; le prestige en est exclu. Une nouvelle mission déjà remplie peut être remportée immédiatement par le joueur actif.</p><p>Une relance coûte ${PRESTIGE.rerollCost} prestige, remplace les trois offres d’un seul marché et ne consomme pas d’action. Limite : ${PRESTIGE.rerollLimitPerTurn} relance(s) par tour. Les anciennes offres vont sous la pioche ; il faut assez de nouvelles cartes pour remplacer le marché. Pour construire, chaque ressource manquante peut être remplacée par ${PRESTIGE.wildcardCost} prestige, après confirmation. Les ressources disponibles sont utilisées d’abord.</p><h3>Le tour de jeu</h3><p>Chaque roi ou unité contrôlable possède 2 déplacements et une action au choix : explorer ou construire, par tour. Sélectionnez une unité, puis cliquez une case voisine par un bord. ${
    Object.values(TERRAINS).filter((t) => !t.walkable).length
      ? `Terrains infranchissables : ${Object.values(TERRAINS)
          .filter((t) => !t.walkable)
          .map((t) => e(t.name))
          .join(", ")}, sauf sur un bâtiment traversable.`
      : "Tous les terrains sont franchissables."
  } Les unités adverses bloquent le passage ; les alliées peuvent partager une case.</p><h3>Explorer et construire</h3><p>Une case inexplorée ouvre un aperçu : choisissez une tuile du marché, sa position et son orientation, puis confirmez. Les cases du motif doivent être libres. Tout terrain peut toucher l’unité, qui reste sur sa case. Déplacez l’unité avant son action. Explorer ou construire termine son activation et ses déplacements restants : le pion devient grisé. Pour construire, choisissez un bâtiment, posez son entrée sous l’unité (ou sur un terrain voisin autorisé) puis confirmez. « Inspecter » permet de consulter la carte sans déplacer de pion. Un clic sur un bâtiment le consulte ; « Aller sur cette case » permet d’y avancer.</p><h3>Ouvriers et population</h3><p>Vous pouvez recruter un ouvrier par tour pour ${e(costText(RECRUITMENT_COST))}, avec une place libre dans vos logements. Il est affectable immédiatement. Les ouvriers se transfèrent instantanément entre vos bâtiments, sans déplacement ni action. Seules les affectations finales produisent, une fois à la fin de votre tour. Le roi n’utilise pas de logement ; ouvriers et unités partagent la capacité des maisons.</p><h3>Unités recrutables</h3>${Object.values(
    UNIT_DEFINITIONS,
  )
    .map(
      (u) =>
        `<p><strong>${e(u.icon)} ${e(u.name)}</strong> : ${e(costText(u.cost))}, ${u.population} population, ${u.moves} pas et une exploration ou construction par tour ; ${u.points * RULES.points.unit} point(s) direct(s). L’unité apparaît sur son bâtiment de recrutement et agit au tour suivant. Chaque bâtiment a son propre quota. Aucun combat n’est prévu.</p>`,
    )
    .join("")}<h3>Bâtiments</h3>${Object.values(BUILDINGS)
    .map(
      (b) =>
        `<p><strong>${e(b.name)}</strong> — ${e(costText(b.cost))}. ${e(b.pattern)} ${e(b.description)}${b.housing ? ` ${b.housing} places de population.` : ""}${b.produces ? ` Production : ${b.production} ${e(RESOURCES[b.produces])} avec un ouvrier.` : ""}</p>`,
    )
    .join(
      "",
    )}<h3>Départ et score</h3><p>Plateau de ${RULES.size} × ${RULES.size}, ${RULES.rounds} tours par joueur. Départ : un roi, un bâtiment de logement, un ouvrier et ${e(costText(RULES.startResources))}. Les cases de départ ne comptent pas comme explorées. Le score compte ${RULES.points.tile} point(s) par case révélée, ${RULES.points.building} par bâtiment et ${RULES.points.worker} par ouvrier, plus les points de vos unités et de vos ressources restantes. Ressources : ${Object.values(
    RESOURCE_DEFINITIONS,
  )
    .map((r) => `${e(r.name)} = ${r.points * RULES.points.resource} point(s)`)
    .join(", ")}. En cas d’égalité, la victoire est partagée.</p>`;
}

export function terrainLegendView() {
  return (
    Object.values(TERRAINS)
      .map(
        (t) =>
          `<span><i style="background:${t.color}" aria-hidden="true"></i>${e(t.name)}</span>`,
      )
      .join("") +
    '<span><i class="unknown" aria-hidden="true"></i>Inexploré</span>'
  );
}

export function missionsView(g) {
  return (
    g.missions.market
      .map((id) => {
        const m = MISSIONS[id];
        return `<article class="mission-card" title="Premier arrivé, premier servi"><div><strong>${e(m.name)}</strong><b>+${m.reward.prestige} ✦</b></div><div class="mission-progress">${g.players.map((p, i) => `<span class="${i === 1 ? "jade" : "amber"}" aria-label="${e(p.name)} : ${missionProgress(g, id, i)} sur ${m.target}">${Math.min(m.target, missionProgress(g, id, i))}/${m.target}</span>`).join("")}</div></article>`;
      })
      .join("") ||
    '<span class="missions-empty">Toutes les missions ont été remportées.</span>'
  );
}
