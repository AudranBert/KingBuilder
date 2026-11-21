import { registerDefinitions } from "./i18n.js";
import { compileConfiguration } from "./config-schema.js";
async function readJson(name) {
  const url = new URL(`../config/${name}.json`, import.meta.url);
  try {
    if (url.protocol === "file:") {
      const { readFile } = await import("node:fs/promises");
      return JSON.parse(await readFile(url, "utf8"));
    }
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    throw Error(`Impossible de lire ${name}.json : ${error.message}`);
  }
}
const mapFiles = await readJson("maps/index");
if (!Array.isArray(mapFiles) || !mapFiles.length ||
    mapFiles.some(name => typeof name !== 'string' || !/^[a-z0-9_-]+$/.test(name)) ||
    new Set(mapFiles).size !== mapFiles.length)
  throw Error("Index des cartes invalide.");
export const MAPS = await Promise.all(mapFiles.map(name => readJson(`maps/${name}`)));
if (MAPS.some(map => !map || typeof map.id !== 'string') || new Set(MAPS.map(map => map.id)).size !== MAPS.length)
  throw Error("Identifiants des cartes invalides ou en double.");
const { files: buildingFiles, ...buildingSettings } = await readJson("buildings/index");
if (!Array.isArray(buildingFiles) || !buildingFiles.length ||
    buildingFiles.some(name => typeof name !== 'string' || !/^[a-z0-9_-]+$/.test(name)) ||
    new Set(buildingFiles).size !== buildingFiles.length)
  throw Error("Index des bâtiments invalide.");
const buildingGroups = await Promise.all(buildingFiles.map(async name => {
  const entries = await readJson(`buildings/${name}`);
  if (!Array.isArray(entries) || !entries.length ||
      !entries.some(b => b?.id === name && !b.family) ||
      entries.some(b => !b || (b.family || b.id) !== name))
    throw Error(`Famille de bâtiments invalide dans buildings/${name}.json.`);
  return entries;
}));
export const BUILDING_CONFIGURATION = { ...buildingSettings, buildings: buildingGroups.flat() };
const { files: tileFiles, ...tileSettings } = await readJson("terrain-tiles/index");
if (!Array.isArray(tileFiles) || !tileFiles.length ||
    tileFiles.some(size => typeof size !== 'string' || !/^[1-9]\d*$/.test(size) || !Number.isSafeInteger(Number(size))) ||
    new Set(tileFiles).size !== tileFiles.length)
  throw Error("Index des tuiles de terrain invalide.");
const tileGroups = await Promise.all(tileFiles.map(async size => {
  const group = await readJson(`terrain-tiles/${size}`);
  const hasSize = entry => Array.isArray(entry?.pattern) &&
    entry.pattern.every(row => typeof row === 'string') &&
    entry.pattern.join('').replaceAll('.', '').length === Number(size);
  if (!group || !Array.isArray(group.shapes) || !group.shapes.length ||
      !Array.isArray(group.tiles) || !group.tiles.length ||
      !group.shapes.every(hasSize) || !group.tiles.every(hasSize) ||
      group.tiles.some(tile => !group.shapes.some(shape => shape.id === tile.shapeId)))
    throw Error(`Taille ou forme de tuile invalide dans terrain-tiles/${size}.json.`);
  return group;
}));
export const TERRAIN_TILE_CONFIGURATION = {
  ...tileSettings,
  shapes: tileGroups.flatMap(group => group.shapes),
  tiles: tileGroups.flatMap(group => group.tiles),
};
const { files: missionFiles, ...missionSettings } = await readJson("missions/index");
if (!Array.isArray(missionFiles) || !missionFiles.length ||
    missionFiles.some(name => typeof name !== 'string' || !/^[a-z0-9_-]+$/.test(name)) ||
    new Set(missionFiles).size !== missionFiles.length)
  throw Error("Index des missions invalide.");
const missionGroups = await Promise.all(missionFiles.map(async name => {
  const entries = await readJson(`missions/${name}`);
  if (!Array.isArray(entries) || !entries.length || entries.some(m => !m || m.family !== name))
    throw Error(`Catégorie de missions invalide dans missions/${name}.json.`);
  return entries;
}));
export const MISSION_CONFIGURATION = { ...missionSettings, missions: missionGroups.flat() };
const [resources, units, gameRules, terrains] =
  await Promise.all(
    [
      "resources",
      "units",
      "game-rules",
      "terrains",
    ].map(readJson),
  );
export const CONFIG = compileConfiguration(
  TERRAIN_TILE_CONFIGURATION,
  BUILDING_CONFIGURATION,
  resources,
  units,
  gameRules,
  terrains,
  MISSION_CONFIGURATION,
);
for (const [category, definitions] of Object.entries({
  buildings: BUILDING_CONFIGURATION.buildings,
  missions: MISSION_CONFIGURATION.missions,
  shapes: TERRAIN_TILE_CONFIGURATION.shapes,
  tiles: TERRAIN_TILE_CONFIGURATION.tiles,
  resources: resources.resources,
  units: units.units,
  terrains: terrains.terrains,
  maps: MAPS,
})) registerDefinitions(category, definitions);
export const RESOURCE_DEFINITIONS = CONFIG.resources;
export const RESOURCES = Object.fromEntries(
  Object.entries(CONFIG.resources).map(([id, r]) => [id, r.name]),
);
export const RESOURCE_ICONS = Object.fromEntries(
  Object.entries(CONFIG.resources).map(([id, r]) => [id, r.icon]),
);
export const START_RESOURCES = Object.fromEntries(
  Object.entries(CONFIG.resources)
    .filter(([, r]) => !r.calculated)
    .map(([id, r]) => [id, r.startingAmount]),
);
export const BUILDINGS = CONFIG.buildings;

export const UNIT_DEFINITIONS = CONFIG.units;

export const TERRAINS = CONFIG.terrains;
