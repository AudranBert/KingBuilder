import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame, startOpening, openingError, placeOpeningTile,
  exploreError, buildError, moveError, endTurn, key,
} from "../src/engine.js";

test("préparation commune : cinq offres, ordre J2 J1 J2 J1 et tour 1 intact", () => {
  const g = createGame(() => 0.42, "local", { mapId: null, boardSize: 13, openingTilesPerPlayer: 2 });
  const originalTiles = new Set([...g.tileMarket, ...g.tileDeck].map(t => t.id));
  startOpening(g);
  assert.equal(g.opening.tiles.length, 5);
  assert.ok(g.opening.tiles.every(tile => [5, 6].includes(tile.cells.length)));
  assert.equal(g.active, 1);
  assert.throws(() => endTurn(g), /setup/);
  assert.match(moveError(g, 11, 6), /setup/);
  assert.match(exploreError(g, 0, 10, 6), /setup/);
  assert.match(buildError(g, 0, 11, 6), /setup/);
  const owners = [];
  for (let turn = 0; turn < 4; turn++) {
    owners.push(g.active);
    const candidate = [...Array(13 * 13)].map((_, n) => [n % 13, Math.floor(n / 13)])
      .find(([px, py]) => !openingError(g, 0, px, py));
    assert.ok(candidate);
    const before = g.opening.tiles.length;
    const placed = placeOpeningTile(g, 0, ...candidate);
    assert.ok(placed.length > 0);
    assert.equal(placed.every(c => g.board[key(c.x,c.y)]?.owner === undefined), true);
    if (g.opening) assert.equal(g.opening.tiles.length, before - 1);
  }
  assert.deepEqual(owners, [1, 0, 1, 0]);
  assert.equal(g.opening, null);
  assert.equal(g.active, 0);
  assert.equal(g.round, 1);
  assert.equal(g.players[0].revealed + g.players[1].revealed, 0);
  assert.equal(g.players[0].resources.material, 3);
  const remainingTiles = [...g.tileMarket, ...g.tileDeck].map(t => t.id);
  assert.equal(remainingTiles.length, originalTiles.size - 4);
  assert.equal(new Set(remainingTiles).size, remainingTiles.length);
  assert.ok(remainingTiles.every(id => originalTiles.has(id)));
  assert.doesNotThrow(() => endTurn(g));
});

test("préparation : pose invalide atomique et solo à deux poses", () => {
  const g = createGame(() => 0.42, "solo", { mapId: null, boardSize: 13, openingTilesPerPlayer: 2 });
  startOpening(g);
  const before = structuredClone(g);
  assert.match(openingError(g, 0, 0, 6), /overlapping/);
  assert.throws(() => placeOpeningTile(g, 0, 0, 6));
  assert.deepEqual(g, before);
  for (let i = 0; i < 2; i++) {
    const position = [...Array(169)].map((_, n) => [n % 13, Math.floor(n / 13)])
      .find(([x,y]) => !openingError(g, 0, x, y));
    placeOpeningTile(g, 0, ...position);
  }
  assert.equal(g.opening, null);
  assert.equal(g.round, 1);
});
