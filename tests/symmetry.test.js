import { test } from "node:test";
import assert from "node:assert/strict";
import { createSandboxGame } from "./helpers.js";
import { transformed, buildingPattern, patternAt, key, migrateGame } from "../src/engine.js";
import { applyCommand } from "../src/commands.js";
import { rotatePoint } from "../src/geometry.js";

test("miroir : terrains et bâtiments gardent leurs propriétés dans les quatre rotations", () => {
  const tile = { cells: [{ x: 0, y: 0, terrain: "plain" }, { x: 1, y: 0, terrain: "forest" }, { x: 1, y: 1, terrain: "river" }] };
  for (let r = 0; r < 4; r++) {
    const expected = tile.cells.map(c => ({ ...rotatePoint(-c.x, c.y, r), terrain: c.terrain }));
    assert.deepEqual(transformed(tile, r + 4), expected);
    const reflected = transformed(tile, 4);
    assert.deepEqual(transformed({ cells: reflected }, 4), tile.cells);
    const building = buildingPattern("farm", r + 4);
    assert.deepEqual(building, buildingPattern("farm").map(c => ({ ...c, ...rotatePoint(-c.x, c.y, r) })));
  }
});

test("les commandes posent les terrains en miroir, y compris pendant la préparation", () => {
  for (const opening of [false, true]) {
    const g = createSandboxGame();
    const tile = { cells: [{x:0,y:0,terrain:"plain"},{x:1,y:0,terrain:"forest"},{x:1,y:1,terrain:"river"}] };
    if (opening) g.opening = { tiles: [tile], remaining: [1, 1], player: 0 };
    else { g.tileMarket[0] = tile; g.players[0].x = 6; g.players[0].y = 7; }
    const result = applyCommand(g, { type: opening ? "placeOpeningTile" : "explore", args: [0, 7, 7, 4] });
    for (const [pos, terrain] of [["7,7","plain"],["6,7","forest"],["6,8","river"]]) assert.equal(result.board[pos]?.terrain, terrain);
    assert.equal(result.board["8,8"], undefined);
  }
});

test("bâtiments en miroir : pose, annexes et sauvegarde conservent l’orientation", () => {
  for (let orientation = 4; orientation < 8; orientation++) {
    const g = createSandboxGame();
    g.players[0].x = 7; g.players[0].y = 7;
    g.players[0].resources = { material:20, food:20, gold:20 };
    g.buildingMarket[0] = "farm";
    const cells = patternAt("farm", 7, 7, orientation);
    for (const c of cells) g.board[key(c.x,c.y)] = { terrain:c.terrain[0] };
    const result = applyCommand(g, { type:"build", args:[0,7,7,orientation] });
    assert.equal(result.board["7,7"].building.rotation, orientation);
    for (const c of cells.filter(c => c.role !== "building")) assert.equal(result.board[key(c.x,c.y)].overlay.anchor, "7,7");
    assert.equal(migrateGame(JSON.parse(JSON.stringify(result))).board["7,7"].building.rotation, orientation);
  }
});
