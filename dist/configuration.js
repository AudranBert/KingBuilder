import { compileConfiguration } from "./config-schema.js";
async function readJson(name) {
  const url = new URL(`./config/${name}.json`, import.meta.url);
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
const [tiles, buildings, resources, units, gameRules, terrains, missions] =
  await Promise.all(
    [
      "terrain-tiles",
      "buildings",
      "resources",
      "units",
      "game-rules",
      "terrains",
      "missions",
    ].map(readJson),
  );
export const CONFIG = compileConfiguration(
  tiles,
  buildings,
  resources,
  units,
  gameRules,
  terrains,
  missions,
);
export const RESOURCE_DEFINITIONS = CONFIG.resources;
export const RESOURCES = Object.fromEntries(
  Object.entries(CONFIG.resources).map(([id, r]) => [id, r.name]),
);
export const RESOURCE_ICONS = Object.fromEntries(
  Object.entries(CONFIG.resources).map(([id, r]) => [id, r.icon]),
);
export const START_RESOURCES = Object.fromEntries(
  Object.entries(CONFIG.resources).map(([id, r]) => [id, r.startingAmount]),
);
export const RECRUITMENT_COST = CONFIG.recruitmentCost;
export const BUILDINGS = CONFIG.buildings;

export const UNIT_DEFINITIONS = CONFIG.units;

export const TERRAINS = CONFIG.terrains;
