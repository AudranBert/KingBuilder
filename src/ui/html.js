import { t, definitionText, getLanguage } from "../i18n.js";
import { RESOURCE_ICONS, TERRAINS, BUILDINGS, buildingPattern, transformed } from "../engine.js";
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
// Format plain prose only, before it is inserted into HTML. Attributes and names
// stay as text; in English, the conjunction "or" must never become a gold icon.
export function resourceTextHTML(value) {
  const aliases = getLanguage() === "fr"
    ? { "points de puissance": "strength", "point de puissance": "strength", puissance: "strength", or: "gold", nourriture: "food", blé: "food", blés: "food", matériaux: "material", matériau: "material", bois: "material" }
    : { strength: "strength", gold: "gold", food: "food", wheat: "food", materials: "material", material: "material", wood: "material" };
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${Object.keys(aliases).join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  const text = String(value ?? "");
  let html = "", offset = 0;
  for (const match of text.matchAll(pattern)) {
    const id = aliases[match[0].toLowerCase()];
    html += e(text.slice(offset, match.index));
    const label = id === "strength" ? match[0] : t(`resources.${id}.name`);
    const icon = id === "strength" ? "assets/textures/interface/sword.svg" : RESOURCE_ICONS[id];
    html += `<span class="resource-symbol" role="img" aria-label="${e(label)}" title="${e(label)}">${iconHTML(icon)}</span>`;
    offset = match.index + match[0].length;
  }
  return html + e(text.slice(offset));
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
            ? 'assets/textures/interface/pattern-building.svg'
          : cell.symbol === '!p'
            ? 'assets/textures/terrains/not-plain-icon.svg'
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
