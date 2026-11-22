import { ruleIssue, ruleIssueText, RuleError } from "./rule-errors.js";
import { CONFIG } from "./configuration.js";
export const GOLD = CONFIG.rules.gold;
export function canAfford(resources, cost) {
  return Object.entries(cost).every(
    ([id, amount]) =>
      Number.isFinite(resources[id] ?? 0) && (resources[id] ?? 0) >= amount,
  );
}
export function payCost(resources, cost) {
  if (!canAfford(resources, cost)) throw new RuleError(ruleIssue("messages.insufficientResources"));
  for (const [id, amount] of Object.entries(cost)) {
    if (amount) resources[id] -= amount;
  }
}

export function buildingPayment(g, index) {
  const cost = CONFIG.buildings[g.buildingMarket[index]]?.cost;
  if (!cost) return null;
  const discount = Object.values(g.board).some(c=>c.building?.owner===g.active && CONFIG.buildings[c.building.type]?.buildingDiscount) ? 1 : 0;
  return costPayment(g, {...cost,material:Math.max(0,(cost.material||0)-discount)});
}
export function tradePrice(g, resource, owner = g.active) {
  if (resource === "gold") return null;
  const producers = Object.values(g.board).filter(c =>
    c.building && c.building.owner !== owner && CONFIG.buildings[c.building.type]?.produces === resource).length;
  const discount=Object.values(g.board).some(c=>c.building?.owner===owner && CONFIG.buildings[c.building.type]?.tradeDiscount)?1:0;
  return Math.max(1,CONFIG.rules.trade.basePrice + producers * CONFIG.rules.trade.producerSurcharge-discount);
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
export function rerollIssue(g, kind) {
  if (g.finished) return ruleIssue("messages.theGameIsOver");
  if (g.opening) return ruleIssue("messages.finishTerrainSetupFirst");
  if (!["terrain", "building"].includes(kind)) return ruleIssue("messages.unknownMarket");
  if (g.rerollsUsed >= GOLD.rerollLimitPerTurn)
    return ruleIssue("messages.rerollAlreadyUsedThisTurn");
  if (g.players[g.active].resources.gold < GOLD.rerollCost)
    return ruleIssue("messages.notEnoughGold");
  const market = kind === "terrain" ? g.tileMarket : g.buildingMarket,
    deck = kind === "terrain" ? g.tileDeck : g.buildingDeck;
  if (!market.length || deck.length < market.length)
    return ruleIssue("messages.theDeckDoesNotHaveEnoughNew");
  if (kind === "building" && (g.buildingReplacements ?? CONFIG.rules.markets.advancedFromReplacement) + 1 < CONFIG.rules.markets.advancedFromReplacement &&
      deck.filter((id) => CONFIG.buildings[id].tier <= CONFIG.rules.markets.initialMaxTier).length < market.length)
    return ruleIssue("messages.theDeckDoesNotHaveEnoughOffers", [CONFIG.rules.markets.initialMaxTier]);
  return null;
}

export function rerollError(...args) {
  const issue = rerollIssue(...args);
  return issue ? ruleIssueText(issue) : null;
}
