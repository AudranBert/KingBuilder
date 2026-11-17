import {
  RESOURCE_ICONS,
  RESOURCES,
  TERRAINS,
  BUILDINGS,
  buildingPattern,
  transformed,
} from "../engine.js";
import { bounds } from "../geometry.js";
import { entryIndex } from "./state.js";

export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const e = escapeHTML;
export function costHTML(cost) {
  return (
    Object.entries(cost)
      .filter(([, amount]) => amount > 0)
      .map(
        ([id, n]) =>
          `<span title="${e(RESOURCES[id] || id)}" aria-label="${n} ${e(RESOURCES[id] || id)}">${n} ${e(RESOURCE_ICONS[id] || id)}</span>`,
      )
      .join(" ") || "Gratuit"
  );
}
export function costText(cost) {
  return (
    Object.entries(cost)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${n} ${RESOURCES[id] || id}`)
      .join(" + ") || "Gratuit"
  );
}
export const coordinates = (x, y) => `${x + 1}, ${y + 1}`;
export function diagram(cells, { building = null, entry = -1 } = {}) {
  if (!cells.length) return "";
  const { minX, maxX, minY, maxY } = bounds(cells),
    step = Math.min(
      building ? 15 : 20,
      64 / Math.max(maxX - minX + 1, maxY - minY + 1),
    );
  const width = (maxX - minX + 1) * step,
    height = (maxY - minY + 1) * step;
  return `<span class="tile-diagram" aria-hidden="true" style="width:${width}px;height:${Math.max(building ? 15 : 46, height)}px">${cells.map((c, i) => `<i class="diagram-cell terrain-${e(Array.isArray(c.terrain) ? c.terrain[0] : c.terrain)} ${c.role === "field" ? "field" : ""} ${i === entry ? "entry" : ""}" style="left:${(c.x - minX) * step}px;top:${(c.y - minY) * step}px;width:${step * 0.9}px;height:${step * 0.9}px;font-size:${Math.min(13, step * 0.7)}px;background:${TERRAINS[Array.isArray(c.terrain) ? c.terrain[0] : c.terrain].color};color:${TERRAINS[Array.isArray(c.terrain) ? c.terrain[0] : c.terrain].foreground}">${e(c.role === "building" ? building?.icon : c.role === "field" ? "≋" : TERRAINS[Array.isArray(c.terrain) ? c.terrain[0] : c.terrain]?.icon)}</i>`).join("")}</span>`;
}
export function terrainDiagram(tile, rotation = 0, anchor = entryIndex(tile)) {
  return diagram(transformed(tile, rotation, anchor), {});
}
export function buildingDiagram(type, rotation = 0) {
  return diagram(buildingPattern(type, rotation), {
    building: BUILDINGS[type],
  });
}
