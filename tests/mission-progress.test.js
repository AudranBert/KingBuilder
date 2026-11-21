import { createSandboxGame as createGame, prepareBuilding } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { endTurn, build, missionTarget } from "../src/engine.js";
import { settleMissions, initializeMissions } from "../src/objectives.js";

import { missionsView } from "../src/ui/views.js";
import { validateGame } from "../src/validation.js";




function farmMission() {
  const g = createGame();
  g.players[0].progress.built = {farm: 1, farm_z: 1};
  g.players[1].progress.built = {farm_t: 4};
  g.missions = {tiered: 1, market: ["built-farm-2"], deck: [], claimed: []};
  initializeMissions(g);
  return g;
}

test("deux fermes déjà construites exigent une troisième et les contributions étrangères ne comptent pas", () => {
  const g = farmMission();
  assert.equal(missionTarget(g, "built-farm-2", 0), 3);
  assert.equal(missionTarget(g, "built-farm-2", 1), 5);
  assert.deepEqual(settleMissions(g), []);
  endTurn(g);
  assert.deepEqual(settleMissions(g), []);
  endTurn(g);
  g.players[0].resources.food=3;
  g.buildingMarket[0] = "house";
  prepareBuilding(g, "house", 1, 6);
  build(g, 0, 1, 6);
  assert.equal(g.missions.claimed.length, 0);
  g.players[0].progress.built.farm_t = 1;
  assert.deepEqual(settleMissions(g), ["built-farm-2"]);
});

test("une mission sous son seuil garde son objectif et les stocks exigent un gain supplémentaire", () => {
  const g = createGame();
  g.players[0].resources.material = 9;
  g.missions = {tiered: 1, market: ["stock-wood", "built-farm-2"], deck: [], claimed: []};
  initializeMissions(g);
  assert.equal(missionTarget(g, "built-farm-2"), 2);
  assert.equal(missionTarget(g, "stock-wood"), 10);
  assert.deepEqual(settleMissions(g), []);
  g.players[0].resources.material++;
  assert.deepEqual(settleMissions(g), ["stock-wood"]);
});

test("les seuils individuels des missions restent stables et les états invalides sont refusés", () => {
  const g = farmMission();
  assert.match(missionsView(g), /2\/3/);
  assert.match(missionsView(g), /4\/5/);
  g.players[0].progress.built.farm_t = 1;
  validateGame(JSON.parse(JSON.stringify(g)));
  assert.equal(missionTarget(g, "built-farm-2"), 3);
  assert.deepEqual(settleMissions(g), ["built-farm-2"]);
  const bad = farmMission();
  bad.missions.baselines["built-farm-2"] = [-1, 0];
  assert.throws(() => validateGame(bad), /progression initiale/);
});
