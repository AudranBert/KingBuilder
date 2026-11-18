import { createSandboxGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { key, score, harvestPreview, assignWorker, endTurn, build, migrateGame, missionTarget } from "../src/engine.js";
import { settleMissions, initializeMissions } from "../src/objectives.js";
import { placementGuidance, dragPreview } from "../src/ui/interactions.js";
import { harvestView, missionsView } from "../src/ui/views.js";
import { validateGame, createPersistence, SAVE_KEY } from "../src/storage.js";

test("les stocks ne donnent plus de points", () => {
  const g = createGame(); g.players[0].resources = { material: 100, food: 100, gold: 100 };
  assert.deepEqual(score(g,0), {buildings:0, flags:0});
});

test("prévision et récolte concordent avec moulin, affectation et réaffectation", () => {
  const g = createGame();
  g.missions.market = [];
  g.board[key(3, 3)] = {terrain: "plain", building: {type: "farm", owner: 0}};
  g.board[key(4, 4)] = {terrain: "plain", building: {type: "mill", owner: 0}};
  g.board[key(6, 6)] = {terrain: "forest", building: {type: "sawmill", owner: 0}};
  g.board[key(7, 7)] = {terrain: "plain", building: {type: "farm", owner: 1}};
  assert.deepEqual(harvestPreview(g).inactive, ["3,3", "6,6"]);
  assert.match(harvestView(g), /Affecter un ouvrier libre/);
  assignWorker(g, 0, 3, 3);
  assert.equal(harvestPreview(g).amounts.food, 2);
  assert.match(harvestView(g), /\+2 nourriture/);
  assignWorker(g, 0, 6, 6);
  assert.equal(harvestPreview(g).amounts.food, 0);
  assert.equal(harvestPreview(g).amounts.material, 1);
  const before = {...g.players[0].resources}, forecast = harvestPreview(g);
  endTurn(g);
  for (const id of Object.keys(before)) assert.equal(g.players[0].resources[id] - before[id], forecast.amounts[id]);
});

test("les guides de placement respectent rotations, action, coût et terrains sans mutation", () => {
  const g = createGame();
  g.buildingMarket = ["house"];
  g.board[key(1, 6)] = {terrain: "plain"};
  const choice = {kind: "building", index: 0, rotation: 0};
  const before = structuredClone(g);
  assert.equal(placementGuidance(g, choice).get("1,6").error, null);
  assert.deepEqual(g, before);
  g.players[0].resources.material = 0;
  g.players[0].resources.gold = 0;
  assert.match(dragPreview(g, choice, {x: 1, y: 6}).error, /1 matériaux/);
  g.players[0].resources.material = 2;
  g.board[key(1, 6)].terrain = "river";
  assert.match(dragPreview(g, choice, {x: 1, y: 6}).error, /terrain incompatible/);
  g.acted = true;
  assert.ok([...placementGuidance(g, choice).values()].every(result => result.error));
  g.acted = false;
  for (const rotation of [0, 1, 2, 3]) {
    const terrain = {kind: "terrain", index: 0, rotation};
    for (const [position, result] of placementGuidance(g, terrain)) {
      const [x, y] = position.split(",").map(Number);
      assert.deepEqual(result, dragPreview(g, terrain, {x, y}));
    }
  }
});

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
  g.buildingMarket[0] = "house";
  g.board[key(1, 6)] = {terrain: "plain"};
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

test("les seuils individuels des missions persistent et les sauvegardes invalides sont refusées", () => {
  const g = farmMission();
  assert.match(missionsView(g), /2\/3/);
  assert.match(missionsView(g), /4\/5/);
  const memory = new Map([[SAVE_KEY, JSON.stringify(g)]]);
  const storage = {getItem: k => memory.get(k), setItem: (k,v) => memory.set(k,v)};
  assert.deepEqual(createPersistence(storage).load(), g);
  g.players[0].progress.built.farm_t = 1;
  migrateGame(g);
  assert.equal(missionTarget(g, "built-farm-2"), 3);
  assert.deepEqual(settleMissions(g), ["built-farm-2"]);
  const bad = farmMission();
  bad.missions.baselines["built-farm-2"] = [-1, 0];
  assert.throws(() => validateGame(bad), /progression initiale/);
});
