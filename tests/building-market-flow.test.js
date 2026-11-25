import { test } from "node:test";
import assert from "node:assert/strict";
import { createSandboxGame as createGame, prepareBuilding } from "./helpers.js";
import { build, endTurn, eliminatePlayer } from "../src/engine.js";
import { validateGame } from "../src/validation.js";
import { buildingMarketView } from "../src/ui/views.js";

function fullRound(g) {
  const round = g.round;
  while (g.round === round && !g.finished) endTurn(g);
}

test("the market grows from three to five, then discards only the oldest card", () => {
  const g = createGame();
  g.buildingMarket = ["farm", "mine", "quarry"];
  g.buildingDeck = ["bridge", "house", "mill", "stable"];
  endTurn(g);
  assert.deepEqual(g.buildingMarket, ["farm", "mine", "quarry"]);
  endTurn(g);
  assert.deepEqual(g.buildingMarket, ["bridge", "farm", "mine", "quarry"]);
  assert.deepEqual(g.buildingDiscard, []);
  fullRound(g);
  assert.deepEqual(g.buildingMarket, ["house", "bridge", "farm", "mine", "quarry"]);
  fullRound(g);
  assert.deepEqual(g.buildingMarket, ["mill", "house", "bridge", "farm", "mine"]);
  assert.deepEqual(g.buildingDiscard, ["quarry"]);
  assert.deepEqual(g.buildingDeck, ["stable"]);
  assert.equal(validateGame(g), g);
  const html = buildingMarketView(g, { buildingRotation: 0 });
  assert.equal((html.match(/data-building="/g) || []).length, 5);
  assert.ok(html.indexOf('data-building-details="mill"') < html.indexOf('data-building-details="mine"'));
});

test("purchases from any slot bring the replacement to the top and preserve survivor order", () => {
  for (const count of [3, 5]) for (let index = 0; index < count; index++) {
    const g = createGame();
    g.buildingMarket = ["farm", "mine", "quarry", "bridge", "tunnel"].slice(0, count);
    g.buildingMarket[index] = "house";
    const remaining = g.buildingMarket.filter((_, i) => i !== index);
    g.buildingDeck = ["sawmill"];
    g.players[0].resources = { food: 10, material: 10, gold: 10 };
    prepareBuilding(g, "house", 1, 6);
    build(g, index, 1, 6);
    assert.deepEqual(g.buildingMarket, ["sawmill", ...remaining]);
    assert.deepEqual(g.buildingDiscard, []);
  }
});

test("an empty deck neither removes the oldest offer nor recycles discarded cards", () => {
  const g = createGame();
  const before = [...g.buildingMarket];
  g.buildingDeck = [];
  g.buildingDiscard = ["mine"];
  fullRound(g);
  assert.deepEqual(g.buildingMarket, before);
  assert.deepEqual(g.buildingDiscard, ["mine"]);
  g.players[0].resources = { food: 10, material: 10, gold: 10 };
  g.buildingMarket[1] = "house";
  prepareBuilding(g, "house", 1, 6);
  build(g, 1, 1, 6);
  assert.deepEqual(g.buildingMarket, [before[0], before[2]]);
});

test("solo and four-player games advance once per full round, skipping eliminated players", () => {
  for (const mode of ["solo", "local"]) {
    const g = createGame(undefined, mode, { playerCount: 4 });
    if (mode === "local") eliminatePlayer(g, g.turnOrder[1]);
    const count = g.players.filter(p => !p.eliminated).length;
    for (let i = 1; i < count; i++) {
      endTurn(g);
      assert.equal(g.buildingMarket.length, 3);
    }
    endTurn(g);
    assert.equal(g.buildingMarket.length, 4);
    assert.equal(g.round, 2);
  }
});

test("older saves without a discard work and the last round does not draw an unused offer", () => {
  const g = createGame();
  delete g.buildingDiscard;
  g.buildingMarket = ["farm", "mine", "quarry", "bridge", "tunnel"];
  g.buildingReplacements = 2;
  g.buildingDeck = ["mill", "stable"];
  fullRound(g);
  assert.deepEqual(g.buildingDiscard, ["tunnel"]);
  assert.equal(validateGame(g), g);
  g.turnLimit = g.round;
  const before = structuredClone(g.buildingMarket);
  fullRound(g);
  assert.ok(g.finished);
  assert.deepEqual(g.buildingMarket, before);
  assert.deepEqual(g.buildingDeck, ["stable"]);
});

test("malformed discard piles are rejected", () => {
  for (const discard of [{}, [42]]) {
    const g = createGame();
    g.buildingDiscard = discard;
    assert.throws(() => validateGame(g));
  }
});
