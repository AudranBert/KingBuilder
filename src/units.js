// Recruits and mission rewards share the same identity and activation rules.
export function spawnUnit(g, x, y, type, owner = g.active) {
  const p = g.players[owner];
  p.nextUnitId = Math.max(p.nextUnitId || 0, ...p.units.map(u => u.id + 1));
  const unit = { id: p.nextUnitId++, type, x, y, home: { x, y }, moves: 0, acted: true, ended: true, skipTurns: 0 };
  p.units.push(unit);
  return unit;
}
