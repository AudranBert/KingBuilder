export function canAfford(resources, cost) {
  return Object.entries(cost).every(
    ([id, amount]) =>
      Number.isFinite(resources[id] ?? 0) && (resources[id] ?? 0) >= amount,
  );
}
export function payCost(resources, cost) {
  if (!canAfford(resources, cost)) throw Error("Ressources insuffisantes.");
  for (const [id, amount] of Object.entries(cost)) {
    if (amount) resources[id] -= amount;
  }
}
