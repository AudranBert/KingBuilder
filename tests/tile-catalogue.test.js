import { createFixedGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { CONFIG, BUILDING_CONFIGURATION, TERRAIN_TILE_CONFIGURATION, MISSION_CONFIGURATION } from "../src/configuration.js";
import { compileConfiguration } from "../src/config-schema.js";
const definitions = await Promise.all(
  [
    "terrain-tiles",
    "buildings",
    "resources",
    "units",
    "game-rules",
    "terrains",
    "missions",
  ].map((n) =>
    n === "missions" ? MISSION_CONFIGURATION : n === "terrain-tiles" ? TERRAIN_TILE_CONFIGURATION : n === "buildings" ? BUILDING_CONFIGURATION : readFile(new URL(`../config/${n}.json`, import.meta.url), "utf8").then(
      JSON.parse,
    ),
  ),
);
const deck = (g) => [...g.tileMarket, ...g.tileDeck];
test("la pioche mélange les tuiles configurées sans modifier leur contenu", () => {
  const a = deck(createGame(() => 0.2)),
    b = deck(createGame(() => 0.8));
  assert.equal(a.length, CONFIG.tiles.length);
  assert.equal(new Set(a.map((t) => t.definitionId)).size, CONFIG.tiles.length);
  const contents = (tiles) =>
    tiles
      .map((t) => [t.definitionId, t.cells])
      .sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(contents(a), contents(b));
  assert.notDeepEqual(
    a.map((t) => t.definitionId),
    b.map((t) => t.definitionId),
  );
  for (const tile of a)
    assert.deepEqual(
      tile.cells,
      CONFIG.tiles.find((t) => t.id === tile.definitionId).cells,
    );
  a[0].cells[0].terrain = "river";
  assert.deepEqual(contents(deck(createGame(() => 0.8))), contents(b));
});

test("les erreurs du catalogue sont identifiées avant de lancer la partie", () => {
  for (const mutate of [
    (c) => c.tiles.push(c.tiles[0]),
    (c) => (c.tiles[0].shapeId = "missing"),
    (c) => (c.tiles[0].pattern = ["ZP"]),
    (c) => (c.tiles[0].pattern = ["PPP"]),
    (c) => (c.deckSize = 47),
    (c) => (c.legend.P = "missing"),
  ]) {
    const input = structuredClone(definitions);
    mutate(input[0]);
    assert.throws(() => compileConfiguration(...input), /terrain-tiles/);
  }
});
