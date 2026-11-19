import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, endTurn, RULES, moveError } from "../src/engine.js";
import { validateGame } from "../src/validation.js";
import { playersView, missionsView, resultsView } from "../src/ui/views.js";

test("solo : un royaume et 25 tours", () => {
  const game = createGame(Math.random, "solo");
  assert.equal(game.players.length, 1);
  assert.equal(Object.values(game.board).filter((c) => c.building).length, 1);
  assert.equal(validateGame(game), game);
  assert.doesNotThrow(() => moveError(game, 1, 6));
  assert.doesNotThrow(() => [
    playersView(game),
    missionsView(game),
    resultsView(game),
  ]);
  for (let round = 1; round < RULES.rounds; round++) {
    endTurn(game);
    assert.equal(game.active, 0);
    assert.equal(game.round, round + 1);
    assert.equal(game.finished, false);
    assert.equal(game.moves, 3);
  }
  endTurn(game);
  assert.equal(game.finished, true);
});

test("local : alternance des deux joueurs", () => {
  const game = createGame();
  assert.equal(game.mode, "local");
  endTurn(game);
  assert.equal(game.active, 1);
  assert.equal(game.round, 1);
  endTurn(game);
  assert.equal(game.active, 0);
  assert.equal(game.round, 2);
  delete game.mode;
  assert.equal(validateGame(game), game);
});

test("les modes verrouillés et les états incohérents sont refusés", () => {
  for (const mode of ["bot", "online"])
    assert.throws(() => createGame(Math.random, mode));
  const game = createGame(Math.random, "solo");
  game.active = 1;
  assert.throws(() => validateGame(game));
  game.active = 0;
  game.mode = "local";
  assert.throws(() => validateGame(game));
});
