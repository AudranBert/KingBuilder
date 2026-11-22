import { buyTerrainError, buildError } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSandboxGame } from "./helpers.js";
import { BUILDINGS, buyTerrain, build, key, productionAmount, score, totalScore } from "../src/engine.js";


test("une case de terrain au choix coûte 1 or et termine l’action", () => {
  const g = createSandboxGame();
  const gold = g.players[0].resources.gold;
  assert.match(buyTerrainError(g, "mountain", 1, 6), /unexplored space/);
  assert.equal(buyTerrainError(g, "mountain", 0, 4) !== null, true);
  assert.equal(buyTerrainError(g, "field", 2, 6) !== null, true);
  g.players[0].units[0].x = 1;
  assert.equal(buyTerrainError(g, "mountain", 2, 6), null);
  buyTerrain(g, "mountain", 2, 6);
  assert.equal(g.board[key(2, 6)].terrain, "mountain");
  assert.equal(g.players[0].resources.gold, gold - 1);
  assert.equal(g.players[0].revealed, 1);
  assert.equal(g.players[g.active].units[0].acted, true);
  assert.throws(() => buyTerrain(g, "forest", 2, 5));
});

test("le moulin peut occuper un champ, exige un champ voisin et le bonifie", () => {
  const g = createSandboxGame();
  g.missions.market = [];
  g.players[0].resources.material = 20;
  g.players[0].units[0].x = 5;
  g.players[0].units[0].y = 5;
  g.board[key(5, 5)] = { terrain: "plain", building: { type: "farm", owner: 0 } };
  g.board[key(6, 5)] = { terrain: "field", overlay: { anchor: key(5, 5), role: "field", owner: 0, previousTerrain: "plain" } };
  g.board[key(6, 6)] = { terrain: "field", overlay: { anchor: key(5, 5), role: "field", owner: 0, previousTerrain: "plain" } };
  g.board[key(7, 5)] = { terrain: "plain" };
  g.board[key(7, 6)] = { terrain: "plain" };
  g.buildingMarket[0] = "mill";
  assert.equal(buildError(g, 0, 6, 5), null);
  build(g, 0, 6, 5);
  assert.equal(g.board[key(6, 5)].building.type, "mill");
  assert.equal(g.board[key(6, 5)].overlay.role, "field");
  assert.equal(productionAmount(g, 5, 5), 3);
  const h = createSandboxGame();
  h.players[0].units[0].x = 5; h.players[0].units[0].y = 5;
  h.board[key(5, 5)] = { terrain: "plain" };
  h.board[key(6, 5)] = { terrain: "plain" };
  h.buildingMarket[0] = "mill";
  assert.ok(buildError(h, 0, 5, 5));
});

test("le décompte ajoute un point par paire d’or restante", () => {
  const g = createSandboxGame();
  g.players[0].resources.gold = 5;
  assert.equal(score(g, 0).gold, undefined);
  g.finished = true;
  assert.equal(score(g, 0).gold, 2);
  assert.equal(totalScore(g, 0), 2);
  assert.equal(BUILDINGS.house.cost.food, 4);
  assert.equal(BUILDINGS.house.cost.material, 4);
});
