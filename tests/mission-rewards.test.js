import { createFixedGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { totalScore, score } from "../src/engine.js";
import { initializeMissions, settleMissions } from "../src/objectives.js";
import { resultsView } from "../src/ui/views.js";
import { validateGame } from "../src/validation.js";

function offers(g, ids) {
  g.missions = { market: ids, deck: [], claimed: [], tiered: 1 };
  initializeMissions(g);
}

test("récompenses croisées et mixtes : stocks crédités une fois sans augmenter la production", () => {
  const g = createGame(), p = g.players[0], before = { ...p.resources };
  offers(g, ["produced-material-4", "produced-food-4", "build-2"]);
  p.progress.produced = { material: 5, food: 5 };
  p.progress.built = { farm: 2, sawmill: 1 };
  assert.deepEqual(settleMissions(g), ["produced-material-4", "produced-food-4", "build-2"]);
  assert.deepEqual(p.resources, { ...before, food: before.food + 3, material: before.material + 3 });
  assert.deepEqual(p.progress.produced, { material: 5, food: 5 });
  assert.deepEqual(settleMissions(g), []);
});

test("les points de mission restent acquis dans le score actuel et final après sérialisation", () => {
  const g = createGame();
  offers(g, ["produced-gold-3", "landscaping-4"]);
  const before = totalScore(g, 0), gold = g.players[0].resources.gold;
  g.players[0].progress.produced.gold = 5;
  g.players[0].progress.landscaping = 4;
  settleMissions(g);
  assert.equal(totalScore(g, 0), before + 3);
  assert.equal(g.players[0].resources.gold, gold);
  assert.equal(score(g, 0).missions, 3);
  const restored = validateGame(JSON.parse(JSON.stringify(g)));
  restored.finished = true;
  assert.equal(score(restored, 0).missions, 3);
  assert.match(resultsView(restored), /Points des missions/);
  assert.doesNotMatch(resultsView(restored), /undefined/);
  restored.players[0].missionScore = -1;
  assert.throws(() => validateGame(restored), /score de missions/);
});
