import { test } from "node:test";
import assert from "node:assert/strict";
import { createSandboxGame } from "./helpers.js";
import { BUILDINGS, patternAt, transformed, explore, startOpening, placeOpeningTile } from "../src/engine.js";
import { rotatePoint } from "../src/geometry.js";
import { dragPreview, placementOrigin } from "../src/ui/interactions.js";

const tile = { cells: [0, 1, 2].map(x => ({ x, y: 0, terrain: "plain" })) };

test("terrain preview and actual exploration share a central anchor in all orientations", () => {
  for (let rotation = 0; rotation < 8; rotation++) {
    const g = createSandboxGame();
    g.players[0].x = 8;
    g.players[0].y = 8;
    g.tileMarket[0] = tile;
    const choice = { kind: "terrain", index: 0, rotation };
    const pointer = { x: 7, y: 7 };
    const origin = placementOrigin(g, choice, pointer);
    const offset = rotatePoint(1, 0, rotation);
    assert.deepEqual(origin, { x: pointer.x - offset.x, y: pointer.y - offset.y });
    const preview = dragPreview(g, choice, pointer);
    assert.equal(preview.error, null);
    assert.ok(preview.cells.some(c => c.x === pointer.x && c.y === pointer.y));
    explore(g, 0, origin.x, origin.y, rotation);
    for (const cell of preview.cells) assert.equal(g.board[`${cell.x},${cell.y}`].terrain, cell.terrain);
  }
});

test("building central anchors are occupied cells and stay consistent through reflection and rotation", () => {
  const g = createSandboxGame();
  for (const type of Object.keys(BUILDINGS)) {
    g.buildingMarket[0] = type;
    const pointer = { x: 5, y: 5 };
    const base = placementOrigin(g, { kind: "building", index: 0, rotation: 0 }, pointer);
    for (let rotation = 0; rotation < 8; rotation++) {
      const choice = { kind: "building", index: 0, rotation };
      const origin = placementOrigin(g, choice, pointer);
      const offset = rotatePoint(pointer.x - base.x, pointer.y - base.y, rotation);
      assert.deepEqual(origin, { x: pointer.x - offset.x, y: pointer.y - offset.y });
      const preview = dragPreview(g, choice, pointer);
      assert.deepEqual(preview.cells, patternAt(type, origin.x, origin.y, rotation));
      assert.ok(preview.cells.some(c => c.x === pointer.x && c.y === pointer.y), type);
    }
  }
});

test("opening placement uses the central anchor too", () => {
  const g = createSandboxGame();
  g.openingTilesPerPlayer = 1;
  startOpening(g);
  g.opening.tiles[0] = tile;
  const choice = { kind: "terrain", index: 0, rotation: 0 };
  const pointer = { x: 7, y: 7 };
  const origin = placementOrigin(g, choice, pointer);
  const preview = dragPreview(g, choice, pointer);
  assert.equal(preview.error, null);
  placeOpeningTile(g, 0, origin.x, origin.y, 0);
  for (const c of preview.cells) assert.equal(g.board[`${c.x},${c.y}`].terrain, c.terrain);
});

test("a hollow center anchors to an occupied cell; single-cell pieces keep their coordinates", () => {
  const g = createSandboxGame();
  g.tileMarket[0] = { cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]].map(([x,y]) => ({ x, y, terrain: "plain" })) };
  const pointer = { x: 5, y: 5 };
  const choice = { kind: "terrain", index: 0, rotation: 0 };
  const origin = placementOrigin(g, choice, pointer);
  assert.ok(transformed(g.tileMarket[0]).some(c => c.x + origin.x === pointer.x && c.y + origin.y === pointer.y));
  for (const kind of ["worker", "unit", "single-terrain"]) assert.deepEqual(placementOrigin(g, { kind }, pointer), pointer);
});
