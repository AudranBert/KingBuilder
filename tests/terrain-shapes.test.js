import { test } from "node:test";
import assert from "node:assert/strict";
import { createSandboxGame } from "./helpers.js";
import { CONFIG } from "../src/configuration.js";
import { key, placement, transformed, explore } from "../src/engine.js";

const coordinates = cells => cells.map(cell => key(cell.x, cell.y)).sort();

test("les tuiles tournent et révèlent seulement leurs cases, en préservant les trous", () => {
  for (const tile of CONFIG.tiles) for (let rotation = 0; rotation < 4; rotation++) {
    const game = createSandboxGame(() => .5);
    game.tileMarket[0] = structuredClone(tile);
    Object.assign(game.players[0].units[0], { x: 6, y: 7 });
    const cells = placement(game, 0, 7, 7, rotation);
    assert.ok(cells, tile.id);
    assert.equal(new Set(coordinates(cells)).size, tile.cells.length, tile.id);
    const turned = transformed(tile, rotation);
    assert.deepEqual(coordinates(transformed({ cells: turned }, (4 - rotation) % 4)), coordinates(transformed(tile, 0)), tile.id);

    const occupied = new Set(coordinates(cells));
    const gaps = [];
    for (let x = Math.min(...cells.map(c => c.x)); x <= Math.max(...cells.map(c => c.x)); x++) {
      for (let y = Math.min(...cells.map(c => c.y)); y <= Math.max(...cells.map(c => c.y)); y++) {
        if (!occupied.has(key(x, y))) {
          game.board[key(x, y)] = { terrain: "forest" };
          gaps.push(key(x, y));
        }
      }
    }
    assert.ok(placement(game, 0, 7, 7, rotation), tile.id);
    const blocked = structuredClone(game);
    blocked.board[key(cells[0].x, cells[0].y)] = { terrain: "plain" };
    assert.equal(placement(blocked, 0, 7, 7, rotation), null, tile.id);

    const before = Object.keys(game.board).length;
    explore(game, 0, 7, 7, rotation);
    assert.equal(Object.keys(game.board).length, before + tile.cells.length, tile.id);
    assert.equal(game.players[0].revealed, tile.cells.length, tile.id);
    for (const cell of cells) assert.equal(game.board[key(cell.x, cell.y)].terrain, cell.terrain, tile.id);
    for (const gap of gaps) assert.deepEqual(game.board[gap], { terrain: "forest" }, tile.id);
  }
});
