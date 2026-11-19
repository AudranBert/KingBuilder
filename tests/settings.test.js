import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GAME_DEFAULTS,
  createGame,
  endTurn,
  gameSettings,
  startOpening,
} from "../src/engine.js";

test("les réglages de partie utilisent les nouvelles valeurs par défaut", () => {
  assert.deepEqual(gameSettings(), GAME_DEFAULTS);
  const g = createGame(() => 0.5, "local", {});
  assert.equal(g.boardSize, 11);
  assert.equal(g.turnLimit, 25);
  assert.equal(g.openingTilesPerPlayer, 2);
  assert.deepEqual(g.players[0].resources, { material: 3, food: 2, gold: 1 });
  assert.deepEqual(g.players[1].resources, { material: 3, food: 2, gold: 2 });
});

test("taille, durée, préparation et ressources personnalisées pilotent la partie", () => {
  const settings = {
    rounds: 20,
    openingTilesPerPlayer: 0,
    boardSize: 7,
    resources: { material: 6, food: 4, gold: 2 },
  };
  const g = createGame(() => 0.5, "local", settings);
  assert.equal(Object.values(g.board).filter((cell) => cell.flag).length, 5);
  assert.ok(Object.keys(g.board).every((position) =>
    position.split(",").every((coordinate) => Number(coordinate) < 7)));
  assert.equal(g.players[1].resources.gold, 3);
  startOpening(g);
  assert.equal(g.opening, null);
  for (let turn = 0; turn < 40; turn++) endTurn(g);
  assert.equal(g.finished, true);
});

test("quatre tuiles par joueur créent huit poses de préparation", () => {
  const g = createGame(() => 0.5, "local", {
    openingTilesPerPlayer: 4,
  });
  startOpening(g);
  assert.equal(g.opening.totalPlacements, 8);
  assert.equal(g.opening.tiles.length, 9);
});

test("les réglages hors limites sont refusés", () => {
  for (const settings of [
    { rounds: 19 },
    { rounds: 41 },
    { openingTilesPerPlayer: 5 },
    { boardSize: 6 },
    { boardSize: 16 },
    { resources: { gold: 11 } },
  ]) assert.throws(() => gameSettings(settings));
});
