import { piece } from "./pieces.js";
import {
  RULES,
  PRESTIGE,
  MISSIONS,
  missionProgress,
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

export function trainingView(g, position, b) {
  const [x, y] = parseKey(position);
  return BUILDINGS[b.type].trains
    .map((type) => {
      const unit = UNIT_DEFINITIONS[type],
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
        `<div class="barracks-card"><strong>${e(BUILDINGS[c.building.type].name)} (${coordinates(...parseKey(position))})</strong>${trainingView(g, position, c.building)}</div>`,
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
        const selected = ui.drag?.kind === "terrain" && ui.drag.index === i;
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
          selected = ui.drag?.kind === "building" && ui.drag.index === i;
        return `<button class="building-card ${selected ? "selected" : ""}" draggable="false" title="Cliquer pour les détails · Glisser pour construire" data-building="${i}" aria-haspopup="dialog">${buildingDiagram(type, ui.buildingRotation)}<span class="building-info"><strong>${buildingStars(b)} ${e(b.name)}</strong><span class="building-effect">${e(b.description)}</span><span class="cost">${costHTML(b.cost)}${b.onBuildGain ? ` · Gain : ${costHTML(b.onBuildGain)}` : ""}</span><span class="building-hint">Détails au clic · Glisser pour construire</span></span></button>`;
      })
      .join("") ||
    '<p class="empty-state">La pioche de bâtiments est épuisée.</p>'
  );
}
function buildingStars(b) {
  return `<span class="building-stars" aria-label="${b.tier} étoile${b.tier > 1 ? "s" : ""}">${b.tier ? "★".repeat(b.tier) : "0 ★"}</span>`;
}
export function buildingDetailsView(type, rotation = 0) {
  const b = BUILDINGS[type];
  if (!b) return "";
  const terrains = [...new Set(b.cells.flatMap(c => c.terrain))];
  return `<div class="building-detail-heading">${buildingStars(b)}<h2 id="building-details-title">${e(b.name)}</h2></div><div class="building-detail-diagram">${buildingDiagram(type, rotation, true)}</div><p class="building-legend">${terrains.map(id => `<span><i style="background:${TERRAINS[id].color}">${e(TERRAINS[id].icon)}</i>${e(TERRAINS[id].name)}</span>`).join("")}</p><p>${e(b.pattern)}</p><p><strong>Effet :</strong> ${e(b.description)}</p><p><strong>${b.constructible === false ? "Disponibilité" : "Coût"} :</strong> ${b.constructible === false ? "Bâtiment de départ uniquement" : costHTML(b.cost)}</p><p class="building-placement-help">${b.constructible === false ? "Le château accueille 2 places de population." : "Le symbole du bâtiment marque l’entrée : placez-la sur la case de l’unité ou sur une case voisine par un bord. Le motif peut pivoter ; toutes ses cases doivent être libres et respecter les terrains indiqués."}</p>`;
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
  return `<h3>Prestige et missions</h3><p>Le premier joueur commence avec ${PRESTIGE.firstPlayerStartingAmount} prestige, le second avec ${PRESTIGE.startingAmount}. Chaque prestige restant vaut ${RULES.points.prestige} points en fin de partie. Trois missions à ★ sont proposées au départ. Chaque mission remportée est remplacée par un objectif aléatoire du niveau supérieur : ★ → ★★ → ★★★, puis ★★★ → ★★★. Chaque variante ne peut être remportée qu’une fois ; lorsque la pioche du niveau requis est vide, l’emplacement disparaît. Les missions sont communes : la première personne à atteindre un objectif visible remporte sa récompense, et une nouvelle mission est révélée. Les cases de départ, le château et l’ouvrier initiaux ne comptent pas. Les stocks correspondent aux ressources détenues au moment de la vérification ; le prestige en est exclu. Une nouvelle mission déjà remplie peut être remportée immédiatement par le joueur actif.</p><p>Une relance coûte ${PRESTIGE.rerollCost} prestige, remplace les trois offres d’un seul marché et ne consomme pas d’action. Limite : ${PRESTIGE.rerollLimitPerTurn} relance(s) par tour. Les anciennes offres vont sous la pioche ; il faut assez de nouvelles cartes pour remplacer le marché. Pour construire, chaque ressource manquante peut être remplacée par ${PRESTIGE.wildcardCost} prestige, après confirmation. Les ressources disponibles sont utilisées d’abord.</p><h3>Le tour de jeu</h3><p>Chaque roi ou unité contrôlable possède 2 déplacements et une action au choix : explorer ou construire, par tour. Sélectionnez une unité, puis cliquez une case voisine par un bord. ${
    Object.values(TERRAINS).filter((t) => !t.walkable).length
      ? `Terrains infranchissables : ${Object.values(TERRAINS)
          .filter((t) => !t.walkable)
          .map((t) => e(t.name))
          .join(", ")}, sauf sur un bâtiment traversable.`
      : "Tous les terrains sont franchissables."
  } Les unités adverses bloquent le passage ; les alliées peuvent partager une case.</p><h3>Explorer et construire</h3><p>Glissez une tuile du marché sur le plateau pour explorer. Pivotez avec R pendant le déplacement ou les boutons du marché avant de glisser. Les cases du motif doivent être libres. Tout terrain peut toucher l’unité, qui reste sur sa case. Déplacez l’unité avant son action. Explorer ou construire termine son activation et ses déplacements restants : le pion devient grisé. Les cartes bâtiments affichent leur tier : 0 ★ pour le pont et le défrichement, ★ pour les producteurs de ressources et les maisons, ★★ pour les moulins et casernes. Le marché initial ne propose que des tiers 0 ou 1 ; ensuite, chaque remplacement ou relance peut proposer les tiers 0, 1 ou 2. Pour construire, glissez un bâtiment sur la case de l’unité ou sur une case voisine par un bord (pas en diagonale). Seul un paiement en prestige demande une confirmation. Les unités se déplacent par glisser-déposer ou par clic sur une case accessible. « Inspecter » permet de consulter la carte sans déplacer de pion. Un clic sur un bâtiment le consulte ; « Aller sur cette case » permet d’y avancer.</p><h3>Ouvriers et population</h3><p>Vous pouvez recruter un ouvrier par tour pour ${e(costText(RECRUITMENT_COST))}, avec une place libre dans vos logements. Il est affectable immédiatement. Les ouvriers se transfèrent instantanément entre vos bâtiments, sans déplacement ni action. Seules les affectations finales produisent, une fois à la fin de votre tour. Le roi n’utilise pas de logement ; ouvriers et unités partagent la capacité des maisons.</p><h3>Unités recrutables</h3>${Object.values(
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
    )}<h3>Départ et score</h3><p>Plateau de ${RULES.size} × ${RULES.size}, ${RULES.rounds} tours par joueur. Départ : un roi, un château non constructible de 2 places de population, un ouvrier et ${e(costText(RULES.startResources))}. Les cases de départ ne comptent pas comme explorées. Le score compte ${RULES.points.tile} point(s) par case révélée, ${RULES.points.building} par bâtiment et ${RULES.points.worker} par ouvrier, plus les points de vos unités et de vos ressources restantes. Ressources : ${Object.values(
    RESOURCE_DEFINITIONS,
  )
    .map((r) => `${e(r.name)} = ${r.points * RULES.points.resource} point(s)`)
    .join(", ")}. En cas d’égalité, la victoire est partagée.</p>`;
}

export function missionsView(g) {
  return (
    g.missions.market
      .map((id) => {
        const m = MISSIONS[id];
        return `<article class="mission-card" title="Premier arrivé, premier servi"><div><strong><span class="mission-stars" aria-label="Difficulté ${m.difficulty} sur 3">${"★".repeat(m.difficulty)}</span>${e(m.name)}</strong><b>+${m.reward.prestige} ✦</b></div><div class="mission-progress">${g.players
          .map((p, i) => {
            const progress = missionProgress(g, id, i);
            return `<span class="${i === 1 ? "jade" : "amber"}" aria-label="${e(p.name)} : ${progress} sur ${m.target}">${Math.min(m.target, progress)}/${m.target}</span>`;
          })
          .join("")}</div></article>`;
      })
      .join("") ||
    '<span class="missions-empty">Plus de missions disponibles.</span>'
  );
}
