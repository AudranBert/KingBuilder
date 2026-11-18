import { createSandboxGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  key,
  placement,
  transformed,
  explore,
  score,
} from "../src/engine.js";
const coordinates = (cells) => cells.map((c) => key(c.x, c.y)).sort();
function getTile(g, id) {
  return [...g.tileMarket, ...g.tileDeck].find((t) => t.id === id);
}
test("la pioche de 60 tuiles comprend treize formes et exclut anneau et rectangle", () => {
  const g = createGame();
  const tiles = [...g.tileMarket, ...g.tileDeck];
  assert.equal(tiles.length, 60);
  assert.equal(
    new Set(tiles.map((t) => JSON.stringify(coordinates(t.cells)))).size,
    13,
  );
  assert.ok(tiles.every((t) => t.cells.length <= 5));
  assert.deepEqual(
    coordinates(getTile(g, 5).cells),
    ["1,0", "0,1", "1,1", "2,1", "1,2"].sort(),
  );
  assert.deepEqual(
    coordinates(getTile(g, 6).cells),
    ["0,0", "2,0", "0,1", "1,1", "2,1"].sort(),
  );
});
test("croix et U pivotent sans remplir leurs vides et restent posables", () => {
  for (const id of [5, 6])
    for (let r = 0; r < 4; r++) {
      const g = createGame();
      g.tileMarket[0] = getTile(g, id);
      const tile = g.tileMarket[0],
        turned = transformed(tile, r);
      const cells = placement(g, 0, 7, 7, r);
      assert.ok(cells);
      assert.equal(cells.length, 5);
      assert.equal(new Set(coordinates(cells)).size, 5);
      const original = transformed(tile, 0);
      const back = transformed({ cells: turned }, (4 - r) % 4);
      assert.deepEqual(coordinates(back), coordinates(original));
      const occupied = new Set(coordinates(cells));
      const minX = Math.min(...cells.map((c) => c.x)),
        maxX = Math.max(...cells.map((c) => c.x)),
        minY = Math.min(...cells.map((c) => c.y)),
        maxY = Math.max(...cells.map((c) => c.y));
      let gaps = 0;
      for (let x = minX; x <= maxX; x++)
        for (let y = minY; y <= maxY; y++)
          if (!occupied.has(key(x, y))) {
            g.board[key(x, y)] = { terrain: "forest" };
            gaps++;
          }
      assert.equal(gaps, id === 5 ? 4 : 1);
      assert.ok(placement(g, 0, 7, 7, r));
      const hit = cells[1];
      g.board[key(hit.x, hit.y)] = { terrain: "plain" };
      assert.equal(placement(g, 0, 7, 7, r), null);
    }
});
test("révéler la croix ou le U révèle cinq cases sans points directs et laisse les vides inexplorés", () => {
  for (const id of [5, 6]) {
    const g = createGame();
    g.tileMarket[0] = getTile(g, id);
    g.players[0].x = 6;
    g.players[0].y = 7;
    const cells = placement(g, 0, 7, 7);
    const occupied = new Set(coordinates(cells));
    const count = Object.keys(g.board).length;
    explore(g, 0, 7, 7);
    assert.equal(Object.keys(g.board).length, count + 5);
    assert.equal(g.players[0].revealed, 5);
    for (let x = 6; x <= 9; x++)
      for (let y = 7; y <= 9; y++)
        if (!occupied.has(key(x, y)))
          assert.equal(g.board[key(x, y)], undefined);
  }
});
test("les cinq ajouts respectent exactement les motifs demandés", () => {
  const g = createGame();
  const expected = [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  ];
  expected.forEach((cells, i) =>
    assert.deepEqual(
      coordinates(getTile(g, 7 + i).cells),
      cells.map(([x, y]) => key(x, y)).sort(),
    ),
  );
});
test("tous les nouveaux motifs pivotent, préservent les trous et marquent uniquement leurs cases", () => {
  for (let id = 7; id <= 12; id++)
    for (let r = 0; r < 4; r++) {
      const g = createGame();
      g.tileMarket[0] = getTile(g, id);
      g.players[0].x = 6;
      g.players[0].y = 7;
      const cells = placement(g, 0, 7, 7, r);
      assert.ok(cells);
      const occupied = new Set(coordinates(cells));
      assert.equal(occupied.size, cells.length);
      const minX = Math.min(...cells.map((c) => c.x)),
        maxX = Math.max(...cells.map((c) => c.x)),
        minY = Math.min(...cells.map((c) => c.y)),
        maxY = Math.max(...cells.map((c) => c.y));
      const empty = [];
      for (let x = minX; x <= maxX; x++)
        for (let y = minY; y <= maxY; y++)
          if (!occupied.has(key(x, y))) {
            g.board[key(x, y)] = { terrain: "forest" };
            empty.push(key(x, y));
          }
      assert.ok(placement(g, 0, 7, 7, r));
      const before = Object.keys(g.board).length;
      explore(g, 0, 7, 7, r);
      assert.equal(Object.keys(g.board).length, before + cells.length);
      assert.equal(g.players[0].revealed, cells.length);
      empty.forEach((k) => assert.deepEqual(g.board[k], { terrain: "forest" }));
    }
});
test("les treize formes sont distinctes même en tenant compte des rotations du T", () => {
  const g = createGame();
  const canonical = (t) => {
    return [0, 1, 2, 3]
      .map((r) => {
        const cells = transformed(t, r),
          minX = Math.min(...cells.map((c) => c.x)),
          minY = Math.min(...cells.map((c) => c.y));
        return cells
          .map((c) => key(c.x - minX, c.y - minY))
          .sort()
          .join(";");
      })
      .sort()[0];
  };
  const shapes = Array.from({ length: 13 }, (_, id) => getTile(g, id));
  assert.equal(new Set(shapes.map(canonical)).size, 13);
  const invertedT = {
    cells: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ],
  };
  assert.equal(canonical(getTile(g, 8)), canonical(invertedT));
});
