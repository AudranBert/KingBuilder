import { MAPS, TERRAINS } from "./configuration.js";

export { MAPS };

// Anchors move with the board; offsets and terrain patterns stay in whole cells.
// A size-specific variant replaces the zones entirely, without interpolation.
export function mapCells(map, size) {
  const cells = new Map();
  for (const zone of map.variants?.[size]?.zones ?? map.zones) {
    const [ax, ay] = zone.anchor;
    if (![ax, ay].every(n => Number.isFinite(n) && n >= 0 && n <= 1))
      throw Error(`Carte ${map.id} : ancrage invalide.`);
    const x0 = Math.floor(ax * (size - 1)) + zone.offset[0];
    const y0 = Math.floor(ay * (size - 1)) + zone.offset[1];
    zone.rows.forEach((row, dy) => [...row].forEach((symbol, dx) => {
      if (symbol === ".") return;
      const x = x0 + dx, y = y0 + dy, terrain = map.legend[symbol];
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size || !TERRAINS[terrain])
        throw Error(`Carte ${map.id} : case invalide en ${x},${y}.`);
      const position = `${x},${y}`;
      if (cells.has(position)) throw Error(`Carte ${map.id} : zones superposées en ${position}.`);
      cells.set(position, { terrain, ...(symbol === "!" ? { flag: { owner: null } } : {}) });
    }));
  }
  return cells;
}

export function chooseMap(id, rng) {
  const map = id === "random" ? MAPS.filter(map => !map.playerCount)[Math.floor(rng() * MAPS.filter(map => !map.playerCount).length)] : MAPS.find(map => map.id === id);
  if (!map) throw Error("Carte inconnue.");
  return map;
}
