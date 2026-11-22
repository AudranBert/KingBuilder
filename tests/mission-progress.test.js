import { createSandboxGame as createGame, prepareBuilding } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { endTurn, build, missionTarget, produce, selectUnit, move, destroyBuilding, harvestPreview, BUILDINGS } from "../src/engine.js";
import { settleMissions, initializeMissions, missionProgress, militaryPower } from "../src/objectives.js";

import { missionsView } from "../src/ui/views.js";
import { validateGame } from "../src/validation.js";




function farmMission() {
  const g = createGame();
  g.players[0].progress.built = {farm: 1, farm_z: 1};
  g.players[1].progress.built = {farm_t: 4};
  g.missions = {tiered: 1, market: ["built-food-2"], deck: [], claimed: []};
  initializeMissions(g);
  return g;
}

test("aménager : ponts, grands ponts et variantes, tunnels et défrichements comptent une fois par pose", () => {
  const types = Object.values(BUILDINGS).filter(b => ["bridge", "great_bridge", "tunnel", "clearing"].includes(b.family || b.id));
  for (const { id: type } of types) {
    const g = createGame(), p = g.players[0];
    g.missions = { tiered: 1, market: ["landscaping-2"], deck: [], claimed: [] };
    p.progress.landscaping = 1;
    initializeMissions(g);
    prepareBuilding(g, type, 4, 4);
    Object.assign(p.units[0], { x: 4, y: 4 });
    p.resources = { material: 50, food: 50, gold: 50 };
    g.buildingMarket[0] = type;
    selectUnit(g, p.units[0].id);
    build(g, 0, 4, 4);
    assert.equal(missionProgress(g, "landscaping-2"), 2, type);
    assert.equal(g.missions.claimed[0]?.id, "landscaping-2", type);
    if (type === "clearing") assert.equal(g.board["4,4"].terrain, "plain");
    const bad = structuredClone(g);
    bad.players[0].progress.landscaping = -1;
    assert.throws(() => validateGame(bad), /progression/);
  }
});

test("deux fermes déjà construites exigent une troisième et les contributions étrangères ne comptent pas", () => {
  const g = farmMission();
  assert.equal(missionTarget(g, "built-food-2", 0), 3);
  assert.equal(missionTarget(g, "built-food-2", 1), 5);
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
  assert.deepEqual(settleMissions(g), ["built-food-2"]);
});

test("les producteurs sont regroupés par ressource, grandes versions et variantes comprises", () => {
  const g = createGame();
  g.players[0].progress.built = { farm: 1, fisher: 2, large_farm: 1, large_fisher: 1,
    sawmill: 1, quarry: 1, large_sawmill: 1, large_quarry: 1, mine_square: 1, port: 1, toll: 1, mill: 1 };
  assert.equal(missionProgress(g, "built-food-3"), 5);
  assert.equal(missionProgress(g, "built-material-3"), 4);
  assert.equal(missionProgress(g, "built-gold-3"), 3);
  assert.equal(missionProgress(g, "built-food-3", 1), 0);
});

test("la production réelle est cumulée après dépense ; ni stocks, ni récompenses, ni aperçus ne comptent", () => {
  const g = createGame(), p = g.players[0];
  g.missions = { tiered: 1, market: ["produced-gold-3"], deck: [], claimed: [] };
  initializeMissions(g);
  p.resources.gold = 100;
  const [manual, automatic] = p.units;
  Object.assign(manual, { x: 2, y: 2 });
  Object.assign(automatic, { x: 3, y: 2 });
  g.board["2,2"] = { terrain: "plain", building: { type: "port", owner: 0 } };
  g.board["3,2"] = { terrain: "forest" };
  harvestPreview(g);
  assert.equal(missionProgress(g, "produced-all-6"), 0);
  selectUnit(g, manual.id); produce(g);
  assert.equal(missionProgress(g, "produced-gold-3"), 1);
  p.resources.gold = 0;
  endTurn(g);
  assert.equal(missionProgress(g, "produced-material-4", 0), 1);
  assert.equal(missionProgress(g, "produced-all-6", 0), 2);
  p.progress.produced.gold = 5;
  g.active = 0;
  assert.deepEqual(settleMissions(g), ["produced-gold-3"]);
  assert.equal(p.resources.gold, 0);
  assert.equal(p.missionScore, 1);
  assert.equal(missionProgress(g, "produced-gold-3"), 5);
  const invalid = structuredClone(g);
  invalid.players[0].progress.produced.gold = -1;
  assert.throws(() => validateGame(invalid), /progression/);
});

test("la puissance militaire compte les forces présentes sans bonus et diminue après les pertes", () => {
  const g = createGame(), p = g.players[0];
  assert.equal(militaryPower(g), 2);
  for (let x = 2; x < 5; x++) g.board[`${x},2`] = { terrain: "plain", building: { type: "outpost", owner: 0 } };
  for (let i = 0; i < 4; i++) p.units.push({ id: p.nextUnitId++, type: "soldier", x: 2, y: 2, moves: 0, acted: true, ended: true });
  assert.equal(militaryPower(g), 12);
  assert.equal(missionProgress(g, "military-10"), 12);
  destroyBuilding(g, 2, 2);
  p.units.pop();
  assert.equal(militaryPower(g), 9);
});

test("les multiplicateurs comptent la possession, leurs variantes et les captures sans condition de voisinage", () => {
  const g = createGame();
  const types = ["mill_l", "wood_mill_forest", "church", "barrack_block", "farm", "market"];
  for (const [i, type] of types.entries()) g.board[`${i+2},2`] = { terrain: "plain", building: { type, owner: 0 } };
  assert.equal(missionProgress(g, "multipliers-3"), 4);
  destroyBuilding(g, 2, 2);
  assert.equal(missionProgress(g, "multipliers-3"), 3);
  g.missions = { tiered: 1, market: ["multipliers-3"], deck: [], claimed: [] };
  initializeMissions(g);
  assert.equal(missionTarget(g, "multipliers-3"), 4);
  g.board["3,3"] = { terrain: "plain", building: { type: "mill", owner: 1 } };
  Object.assign(g.players[0].units[0], { x: 2, y: 3 });
  selectUnit(g, g.players[0].units[0].id);
  move(g, 3, 3);
  assert.equal(g.missions.claimed[0].id, "multipliers-3");
  assert.equal(missionProgress(g, "multipliers-3"), 4);
});

test("une mission sous son seuil garde son objectif et la production exige un gain supplémentaire", () => {
  const g = createGame();
  g.players[0].progress.produced.material = 9;
  g.missions = {tiered: 1, market: ["produced-material-4", "built-food-2"], deck: [], claimed: []};
  initializeMissions(g);
  assert.equal(missionTarget(g, "built-food-2"), 3);
  assert.equal(missionTarget(g, "produced-material-4"), 10);
  assert.deepEqual(settleMissions(g), []);
  g.players[0].progress.produced.material++;
  assert.deepEqual(settleMissions(g), ["produced-material-4"]);
});

test("les seuils individuels des missions restent stables et les états invalides sont refusés", () => {
  const g = farmMission();
  assert.match(missionsView(g), /2\/3/);
  assert.match(missionsView(g), /4\/5/);
  g.players[0].progress.built.farm_t = 1;
  validateGame(JSON.parse(JSON.stringify(g)));
  assert.equal(missionTarget(g, "built-food-2"), 3);
  assert.deepEqual(settleMissions(g), ["built-food-2"]);
  const bad = farmMission();
  bad.missions.baselines["built-food-2"] = [-1, 0];
  assert.throws(() => validateGame(bad), /progression initiale/);
});
