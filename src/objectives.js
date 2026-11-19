import { CONFIG } from "./configuration.js";
export const GOLD = CONFIG.rules.gold;
export const MISSIONS = CONFIG.missions;
export function emptyProgress() {
  return { terrain: {}, built: {}, recruited: 0 };
}
export function missionProgress(g, id, owner = g.active) {
  const m = MISSIONS[id],
    p = g.players[owner];
  if (!m) return 0;
  if (m.metric === "revealed")
    return m.terrain ? p.progress.terrain[m.terrain] || 0 : p.revealed;
  if (m.metric === "built")
    return m.building
      ? Object.entries(p.progress.built).reduce(
          (total, [type, count]) => total +
            ((CONFIG.buildings[type]?.family || type) === m.building ? count : 0), 0)
      : Object.values(p.progress.built).reduce((a, b) => a + b, 0);
  if (m.metric === "recruited") return p.progress.recruited;
  if (m.metric === "resources")
    return m.resource
      ? p.resources[m.resource] || 0
      : Object.keys(CONFIG.resources).reduce(
          (n, id) => n + (p.resources[id] || 0),
          0,
        );
  return 0;
}
export function missionTarget(g, id, owner = g.active) {
  const baseline = g.missions.baselines?.[id]?.[owner];
  return Math.max(MISSIONS[id].target, baseline === undefined ? 0 : baseline + CONFIG.missionRules.requiredContribution);
}
function revealMission(g, id) {
  g.missions.baselines ??= {};
  g.missions.baselines[id] = g.players.map((_, owner) => missionProgress(g, id, owner));
}
export function initializeMissions(g, missionOrder = Object.keys(MISSIONS)) {
  g.rerollsUsed ??= 0;
  for (const [owner, p] of g.players.entries()) {
    if (!p.progress) {
      p.progress = emptyProgress();
      // Historic terrain before transformations is unavailable in older states.
      const spawn = CONFIG.rules.players[owner].start;
      const startKey = `${Math.min(CONFIG.rules.boardSize - 1, Math.floor(spawn.x * CONFIG.rules.boardSize))},${Math.min(CONFIG.rules.boardSize - 1, Math.floor(spawn.y * CONFIG.rules.boardSize))}`;
      for (const [position, c] of Object.entries(g.board)) {
        if (
          c.owner === owner &&
          position !== startKey &&
          c.overlay?.anchor !== startKey
        )
          p.progress.terrain[c.terrain] =
            (p.progress.terrain[c.terrain] || 0) + 1;
        if (c.building?.owner === owner)
          p.progress.built[c.building.type] =
            (p.progress.built[c.building.type] || 0) + 1;
      }
      const start = CONFIG.startingBuilding;
      p.progress.built[start] = Math.max(0, (p.progress.built[start] || 0) - 1);
      p.progress.recruited = Math.max(0, p.workers - CONFIG.rules.startingWorkers);
    }
  }
  if (!g.missions) {
    const deck = [...missionOrder];
    const market = [];
    for (
      let i = 0;
      i < deck.length && market.length < CONFIG.missionMarketSize;

    ) {
      if (MISSIONS[deck[i]].difficulty === CONFIG.missionRules.initialDifficulty) market.push(...deck.splice(i, 1));
      else i++;
    }
    g.missions = { market, deck, claimed: [], tiered: 1 };
  } else if (g.missions.tiered === undefined) {
    // Preserve offers, ownership and rewards in existing states; add new variants once.
    const known = new Set([
      ...g.missions.market,
      ...g.missions.deck,
      ...g.missions.claimed.map((c) => c.id),
    ]);
    for (const id of missionOrder) if (!known.has(id)) g.missions.deck.push(id);
    g.missions.tiered = 1;
  }
  for (const id of g.missions.market)
    if (!g.missions.baselines?.[id]) revealMission(g, id);
}
export function settleMissions(g, owner = g.active) {
  const won = [];
  // Each offer needs fresh progress after its reveal, for each player.
  for (let i = 0; i < g.missions.market.length; ) {
    const id = g.missions.market[i],
      m = MISSIONS[id];
    if (missionProgress(g, id, owner) < missionTarget(g, id, owner)) {
      i++;
      continue;
    }
    g.players[owner].resources.gold += m.reward.gold;
    g.missions.claimed.push({ id, owner, round: g.round });
    won.push(id);
    g.missions.market.splice(i, 1);
    if (g.missions.baselines) delete g.missions.baselines[id];
    const nextLevel = Math.min(CONFIG.missionRules.maxDifficulty, m.difficulty + 1);
    const nextIndex = g.missions.deck.findIndex(
      (next) => MISSIONS[next].difficulty === nextLevel,
    );
    if (nextIndex !== -1) {
      const [next] = g.missions.deck.splice(nextIndex, 1);
      g.missions.market.splice(i, 0, next);
      revealMission(g, next);
    }
    i = 0;
  }
  return won;
}
export function buildingPayment(g, index) {
  const cost = CONFIG.buildings[g.buildingMarket[index]]?.cost;
  if (!cost) return null;
  return costPayment(g, cost);
}
export function tradePrice(g, resource) {
  if (resource === "gold") return null;
  const producers = Object.values(g.board).filter(c =>
    c.building && c.building.owner !== g.active && CONFIG.buildings[c.building.type]?.produces === resource).length;
  return CONFIG.rules.trade.basePrice + producers * CONFIG.rules.trade.producerSurcharge;
}
export function costPayment(g, cost) {
  const p = g.players[g.active],
    resources = {},
    missing = {};
  let gold = cost.gold || 0;
  for (const [id, n] of Object.entries(cost)) {
    if (id === "gold") continue;
    const held = p.resources[id] ?? 0;
    if (!Number.isSafeInteger(held) || held < 0) return null;
    resources[id] = Math.min(n, held);
    if (n > held) {
      missing[id] = n - held;
      gold += (n - held) * tradePrice(g, id);
    }
  }
  const purchaseGold = gold - (cost.gold || 0);
  resources.gold = gold;
  return {
    resources,
    missing,
    gold: purchaseGold,
    totalGold: gold,
    affordable: Number.isSafeInteger(p.resources.gold) && p.resources.gold >= gold,
  };
}
export function rerollError(g, kind) {
  if (g.finished) return "La partie est terminée.";
  if (g.opening) return "Terminez d’abord la préparation du terrain.";
  if (!["terrain", "building"].includes(kind)) return "Marché inconnu.";
  if (g.rerollsUsed >= GOLD.rerollLimitPerTurn)
    return "Relance déjà utilisée ce tour.";
  if (g.players[g.active].resources.gold < GOLD.rerollCost)
    return "Or insuffisant.";
  const market = kind === "terrain" ? g.tileMarket : g.buildingMarket,
    deck = kind === "terrain" ? g.tileDeck : g.buildingDeck;
  if (!market.length || deck.length < market.length)
    return "La pioche ne contient plus assez de nouvelles offres.";
  if (kind === "building" && (g.buildingReplacements ?? CONFIG.rules.markets.advancedFromReplacement) + 1 < CONFIG.rules.markets.advancedFromReplacement &&
      deck.filter((id) => CONFIG.buildings[id].tier <= CONFIG.rules.markets.initialMaxTier).length < market.length)
    return `La pioche ne contient plus assez d’offres de tier ${CONFIG.rules.markets.initialMaxTier} ou inférieur.`;
  return null;
}
