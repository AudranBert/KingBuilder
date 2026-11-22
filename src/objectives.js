import { message as sourceMessage } from "./i18n.js";
import { CONFIG } from "./configuration.js";
import { spawnUnit } from "./units.js";
export const MISSIONS = CONFIG.missions;
export function emptyProgress() {
  return { terrain: {}, built: {}, recruited: 0, produced: {}, conquests: [], landscaping: 0 };
}
export function missionProgress(g, id, owner = g.active) {
  const m = MISSIONS[id],
    p = g.players[owner];
  if (!m) return 0;
  if (m.metric === "conquests") return p.progress.conquests?.length || 0;
  if (m.metric === "landscaping") return p.progress.landscaping || 0;
  if (m.metric === "revealed")
    return m.terrain ? p.progress.terrain[m.terrain] || 0 : p.revealed;
  if (m.metric === "built-distinct")
    return new Set(Object.entries(p.progress.built)
      .filter(([, count]) => count > 0)
      .map(([type]) => CONFIG.buildings[type]?.family || type)).size;
  if (m.metric === "built")
    return m.producerResource
      ? Object.entries(p.progress.built).reduce((total, [type, count]) =>
          total + (CONFIG.buildings[type]?.produces === m.producerResource ? count : 0), 0)
      : m.building
      ? Object.entries(p.progress.built).reduce(
          (total, [type, count]) => total +
            ((CONFIG.buildings[type]?.productionFamily || CONFIG.buildings[type]?.family || type) === m.building ? count : 0), 0)
      : Object.values(p.progress.built).reduce((a, b) => a + b, 0);
  if (m.metric === "multipliers")
    return Object.values(g.board).filter(c => c.building?.owner === owner &&
      isMultiplier(CONFIG.buildings[c.building.type])).length;
  if (m.metric === "military") return militaryPower(g, owner);
  if (m.metric === "produced")
    return m.resource
      ? p.progress.produced?.[m.resource] || 0
      : Object.keys(CONFIG.resources).reduce(
          (n, id) => n + (p.progress.produced?.[id] || 0),
          0,
        );
  return 0;
}
export function isMultiplier(building) {
  return Boolean(building?.boost || building?.monumentMultiplier || building?.trainingBoost);
}
export function recordConquest(g, owner, target) {
  const targets = g.players[owner].progress.conquests ??= [];
  if (!targets.includes(target)) targets.push(target);
}
export function militaryPower(g, owner = g.active) {
  return g.players[owner].units.filter(u => u.type === "soldier").length +
    Object.values(g.board).reduce((total, c) => total +
      (c.building?.owner === owner ? CONFIG.buildings[c.building.type]?.garrison || 0 : 0), 0);
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
  if (g.missionsEnabled === false) {
    g.missions = { market: [], deck: [], claimed: [], tiered: 1, baselines: {} };
    return;
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
  for (const p of g.players) p.progress.produced ??= {};
  for (const id of g.missions.market)
    if (!g.missions.baselines?.[id]) revealMission(g, id);
}
export function settleMissions(g, owner = g.active) {
  const won = [];
  if (g.missionsEnabled === false) return won;
  // Each offer needs fresh progress after its reveal, for each player.
  for (let i = 0; i < g.missions.market.length; ) {
    const id = g.missions.market[i],
      m = MISSIONS[id];
    if (missionProgress(g, id, owner) < missionTarget(g, id, owner)) {
      i++;
      continue;
    }
    const player = g.players[owner];
    for (const [type, amount] of Object.entries(m.reward)) {
      if (type === "score") player.missionScore = (player.missionScore || 0) + amount;
      else if (type === "soldiers") {
        for (let n = 0; n < amount; n++) spawnUnit(g, player.home.x, player.home.y, "soldier", owner);
      } else player.resources[type] += amount;
    }
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
