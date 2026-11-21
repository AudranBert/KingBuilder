import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGame } from "../src/engine.js";
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
test("48 tuiles fixes, sans répétition et sans tirage aléatoire de terrains", () => {
  const a = deck(createGame(() => 0.2)),
    b = deck(createGame(() => 0.8));
  assert.equal(a.length, 48);
  assert.equal(new Set(a.map((t) => t.definitionId)).size, 48);
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
test("les 13 formes, les fermes, mines et ports ont des motifs exploitables", () => {
  assert.equal(new Set(CONFIG.tiles.map((t) => t.shapeId)).size, 13);
  assert.ok(CONFIG.tiles.some((t) => t.pattern.join("/") === ".P./PPP/.P."));
  assert.ok(CONFIG.tiles.some((t) => t.pattern.join("/") === "PMMM"));
  assert.ok(CONFIG.tiles.some((t) => t.pattern.join("/") === "RRR/.P./.P."));
  assert.ok(
    CONFIG.tiles.some((t) => t.cells.every((c) => c.terrain === "river")),
  );
  const canonical = (tile) =>
    [0, 1, 2, 3]
      .map((r) => {
        const cells = tile.cells.map((c) => {
          let x = c.x,
            y = c.y;
          for (let i = 0; i < r; i++) [x, y] = [-y, x];
          return { ...c, x, y };
        });
        const minX = Math.min(...cells.map((c) => c.x)),
          minY = Math.min(...cells.map((c) => c.y));
        return cells
          .map((c) => `${c.x - minX},${c.y - minY}:${c.terrain}`)
          .sort()
          .join(";");
      })
      .sort()[0];
  assert.equal(new Set(CONFIG.tiles.map(canonical)).size, 48);
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

test("la pioche conserve les tuiles de deux à cinq cases et leur composition", () => {
  const counts = { plain: 0, forest: 0, river: 0, mountain: 0 };
  const sizes = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const tile of CONFIG.tiles) {
    sizes[tile.cells.length]++;
    for (const cell of tile.cells) counts[cell.terrain]++;
  }
  assert.deepEqual(sizes, { 2: 3, 3: 12, 4: 15, 5: 18, 6: 0 });
  assert.deepEqual(counts, { plain: 82, forest: 46, river: 42, mountain: 22 });
  assert.ok(CONFIG.tiles.every(tile => tile.cells.length <= 5));
});
