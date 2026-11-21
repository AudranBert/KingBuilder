import { t, definitionText } from "../i18n.js";
import {
  RESOURCE_ICONS,
  RESOURCES,
  TERRAINS,
  BUILDINGS,
  buildingPattern,
  transformed,
} from "../engine.js";
import { bounds } from "../geometry.js";

export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const e = escapeHTML;
export function iconHTML(path, className = "asset-icon") {
  const url = new URL(`../../${path}`, import.meta.url).href;
  return `<img class="${e(className)}" src="${e(url)}" alt="" aria-hidden="true">`;
}
export function costHTML(cost) {
  return (
    Object.entries(cost)
      .filter(([, amount]) => amount > 0)
      .map(
        ([id, n]) =>
          `<span title="${e(t(`resources.${id}.name`) || id)}" aria-label="${n} ${e(t(`resources.${id}.name`) || id)}">${n} ${iconHTML(RESOURCE_ICONS[id])}</span>`,
      )
      .join(" ") || t("html.free")
  );
}
export function costText(cost) {
  return (
    Object.entries(cost)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${n} ${t(`resources.${id}.name`) || id}`)
      .join(" + ") || t("html.free")
  );
}
export const coordinates = (x, y) => `${x + 1}, ${y + 1}`;
export function diagram(cells, { building = null, large = false, maxSize = 64 } = {}) {
  if (!cells.length) return "";
  const { minX, maxX, minY, maxY } = bounds(cells),
    step = Math.min(
      building ? (large ? 40 : 24) : 20,
      (building ? (large ? 200 : 72) : maxSize) / Math.max(maxX - minX + 1, maxY - minY + 1),
    );
  const width = (maxX - minX + 1) * step,
    height = (maxY - minY + 1) * step;
  const content = cells
    .map((cell) => {
      const terrainId = cell.excludedTerrain || (building?.createsFields && cell.symbol === 'p' ? 'field' : cell.transformTo) || (Array.isArray(cell.terrain)
          ? cell.terrain[0]
          : cell.terrain),
        terrain = TERRAINS[terrainId],
        field = terrainId === 'field',
        icon =
          cell.symbol === 'c'
            ? 'assets/textures/pattern-building.svg'
          : cell.symbol === '!p'
            ? 'assets/textures/terrains-not-plain.svg'
          : cell.symbol === 'B' || (cell.symbol === 'r' && building?.greatBridge)
            ? building?.icon
            : field
              ? TERRAINS.field.icon
              : terrain.icon;
      const conditionLabel = cell.excludedTerrain
        ? t('html.excludedTerrain',[definitionText('terrains',TERRAINS[cell.excludedTerrain])])
        : t(cell.symbol === 'c' ? 'html.existingBuilding' : 'html.neighbourTerrain');
      const conditionTitle = cell.symbol !== 'B' && building ? ` title="${e(conditionLabel)}"` : '';
      const background = cell.symbol === 'c' ? '#e9dfc7' : `${terrain.color} url(${e(new URL(`../../${terrain.texture}`, import.meta.url).href)}) center/cover`;
      return `<i class="diagram-cell terrain-${e(terrainId)} ${field ? "field" : ""} ${cell.symbol === '!p' ? 'terrain-choice' : cell.excludedTerrain ? 'excluded-terrain' : ''}"${conditionTitle} style="left:${(cell.x - minX) * step}px;top:${(cell.y - minY) * step}px;width:${step * 0.9}px;height:${step * 0.9}px;font-size:${Math.min(building ? (large ? 26 : 18) : 13, step * 0.7)}px;background:${background};color:${terrain.foreground}">${iconHTML(icon)}</i>`;
    })
    .join("");
  return `<span class="tile-diagram" aria-hidden="true" style="width:${width}px;height:${Math.max(building ? 15 : 46, height)}px">${content}</span>`;
}
export function terrainDiagram(tile, rotation = 0, maxSize = 64) {
  return diagram(transformed(tile, rotation), { maxSize });
}
export function buildingDiagram(type, rotation = 0, large = false) {
  return diagram(buildingPattern(type, rotation), {
    building: BUILDINGS[type],
    large,
  });
}
