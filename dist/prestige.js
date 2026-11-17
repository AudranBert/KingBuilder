import { CONFIG } from "./configuration.js";
export const PRESTIGE = CONFIG.rules.prestige;
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
      ? p.progress.built[m.building] || 0
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
export function initializePrestige(g, missionOrder = Object.keys(MISSIONS)) {
  g.rerollsUsed ??= 0;
  for (const [owner, p] of g.players.entries()) {
    p.prestige ??=
      owner === 0
        ? PRESTIGE.firstPlayerStartingAmount
        : PRESTIGE.startingAmount;
    if (!p.progress) {
      p.progress = emptyProgress();
      // Historic terrain before transformations is unavailable in older saves.
      const startKey = `${owner === 0 ? 0 : CONFIG.rules.boardSize - 1},${Math.floor(CONFIG.rules.boardSize / 2)}`;
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
      p.progress.recruited = Math.max(0, p.workers - 1);
    }
  }
  if (!g.missions) {
    const deck = [...missionOrder];
    g.missions = {
      market: deck.splice(0, CONFIG.missionMarketSize),
      deck,
      claimed: [],
    };
  }
}
export function settleMissions(g, owner = g.active) {
  const won = [];
  // Newly offered missions can also be met; the deck is finite.
  for (let i = 0; i < g.missions.market.length; ) {
    const id = g.missions.market[i],
      m = MISSIONS[id];
    if (missionProgress(g, id, owner) < m.target) {
      i++;
      continue;
    }
    g.players[owner].prestige += m.reward.prestige;
    g.missions.claimed.push({ id, owner, round: g.round });
    won.push(id);
    g.missions.market.splice(i, 1);
    if (g.missions.deck.length)
      g.missions.market.splice(i, 0, g.missions.deck.shift());
    i = 0;
  }
  return won;
}
export function buildingPayment(g, index) {
  const cost = CONFIG.buildings[g.buildingMarket[index]]?.cost;
  if (!cost) return null;
  const p = g.players[g.active],
    resources = {},
    missing = {};
  let missingCount = 0;
  for (const [id, n] of Object.entries(cost)) {
    const held = p.resources[id] ?? 0;
    if (!Number.isSafeInteger(held) || held < 0) return null;
    resources[id] = Math.min(n, held);
    if (n > held) {
      missing[id] = n - held;
      missingCount += n - held;
    }
  }
  const prestige = missingCount * PRESTIGE.wildcardCost;
  return {
    resources,
    missing,
    prestige,
    affordable: Number.isSafeInteger(p.prestige) && p.prestige >= prestige,
  };
}
export function rerollError(g, kind) {
  if (g.finished) return "La partie est terminée.";
  if (!["terrain", "building"].includes(kind)) return "Marché inconnu.";
  if (g.rerollsUsed >= PRESTIGE.rerollLimitPerTurn)
    return "Relance déjà utilisée ce tour.";
  if (g.players[g.active].prestige < PRESTIGE.rerollCost)
    return "Prestige insuffisant.";
  const market = kind === "terrain" ? g.tileMarket : g.buildingMarket,
    deck = kind === "terrain" ? g.tileDeck : g.buildingDeck;
  if (!market.length || deck.length < market.length)
    return "La pioche ne contient plus assez de nouvelles offres.";
  return null;
}
