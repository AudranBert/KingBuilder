import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  key,
  BUILDINGS,
  UNIT_DEFINITIONS,
  actor,
  selectUnit,
  trainUnit,
  trainError,
  population,
  housing,
  move,
  explore,
  build,
  buildError,
  recruit,
  endTurn,
  migrateGame,
  score,
} from "../dist/engine.js";
function setup() {
  const g = createGame();
  g.board[key(5, 5)] = {
    terrain: "plain",
    building: { type: "barracks", owner: 0 },
  };
  g.players[0].resources = { wood: 10, stone: 10, iron: 5, wheat: 5 };
  return g;
}
function nextOwnTurn(g) {
  endTurn(g);
  endTurn(g);
}
test("la caserne figure dans la pioche et le cavalier coûte un fer et un blé", () => {
  const g = setup();
  assert.ok([...g.buildingMarket, ...g.buildingDeck].includes("barracks"));
  assert.deepEqual(UNIT_DEFINITIONS.cavalry.cost, { iron: 1, wheat: 1 });
  assert.deepEqual(BUILDINGS.barracks.trains, ["cavalry"]);
  const iron = g.players[0].resources.iron,
    wheat = g.players[0].resources.wheat;
  const unit = trainUnit(g, 5, 5, "cavalry");
  assert.equal(g.players[0].resources.iron, iron - 1);
  assert.equal(g.players[0].resources.wheat, wheat - 1);
  assert.deepEqual([unit.x, unit.y], [5, 5]);
  assert.equal(unit.moves, 0);
  assert.equal(population(g, 0), 2);
  assert.equal(housing(g, 0), 2);
  assert.equal(g.moves, 2);
  assert.equal(g.acted, false);
  assert.equal(g.recruited, false);
});
test("capacité des maisons partagée entre ouvriers et cavaliers", () => {
  const g = setup();
  trainUnit(g, 5, 5, "cavalry");
  assert.throws(() => recruit(g), /maison/);
  const h = setup();
  recruit(h);
  assert.throws(() => trainUnit(h, 5, 5, "cavalry"), /maison/);
});
test("une unité par caserne et par tour ; plusieurs casernes ont des quotas séparés", () => {
  const g = setup();
  g.board[key(2, 6)] = {
    terrain: "plain",
    building: { type: "house", owner: 0 },
  };
  trainUnit(g, 5, 5, "cavalry");
  assert.throws(() => trainUnit(g, 5, 5, "cavalry"), /déjà/);
  g.board[key(8, 8)] = {
    terrain: "plain",
    building: { type: "barracks", owner: 0 },
  };
  trainUnit(g, 8, 8, "cavalry");
  assert.equal(g.players[0].units.length, 2);
  nextOwnTurn(g);
  trainUnit(g, 5, 5, "cavalry");
  assert.equal(g.players[0].units.length, 3);
});
test("le nouveau cavalier agit au prochain tour, avec deux déplacements indépendants du roi", () => {
  const g = setup();
  const u = trainUnit(g, 5, 5, "cavalry");
  selectUnit(g, u.id);
  g.board[key(6, 5)] = { terrain: "plain" };
  g.board[key(7, 5)] = { terrain: "forest" };
  assert.throws(() => move(g, 6, 5));
  nextOwnTurn(g);
  selectUnit(g, u.id);
  move(g, 6, 5);
  move(g, 7, 5);
  assert.equal(actor(g).moves, 0);
  assert.equal(g.moves, 2);
  assert.equal(g.players[0].x, 0);
  assert.throws(() => move(g, 6, 5));
  selectUnit(g, null);
  g.board[key(1, 6)] = { terrain: "plain" };
  move(g, 1, 6);
  assert.equal(g.moves, 1);
  assert.equal(u.moves, 0);
});
test("le cavalier révèle une tuile, marque ses cases et ne dépense pas l’action du roi", () => {
  const g = setup();
  const u = trainUnit(g, 5, 5, "cavalry");
  nextOwnTurn(g);
  selectUnit(g, u.id);
  g.tileMarket[0] = {
    cells: [
      { x: 0, y: 0, terrain: "plain" },
      { x: 1, y: 0, terrain: "forest" },
    ],
  };
  assert.equal(move(g, 6, 5), "explore");
  explore(g, 0, 6, 5);
  assert.equal(g.players[0].revealed, 2);
  assert.deepEqual([u.x, u.y], [5, 5]);
  assert.equal(u.acted, true);
  assert.equal(g.acted, false);
  assert.equal(g.moves, 2);
  selectUnit(g, null);
  assert.equal(actor(g).name, "Roi");
  assert.equal(actor(g).acted, false);
});
test("le cavalier construit sous lui et partage les ressources et le marché du roi", () => {
  const g = setup();
  const u = trainUnit(g, 5, 5, "cavalry");
  nextOwnTurn(g);
  selectUnit(g, u.id);
  g.board[key(6, 5)] = { terrain: "forest" };
  move(g, 6, 5);
  g.buildingMarket[0] = "sawmill";
  const stone = g.players[0].resources.stone;
  build(g, 0, 6, 5);
  assert.equal(g.board[key(6, 5)].building.owner, 0);
  assert.equal(g.players[0].resources.stone, stone - 1);
  assert.equal(u.acted, true);
  assert.equal(g.acted, false);
  assert.equal(g.buildingMarket.length, 3);
});
test("terrains infranchissables, ponts et pions adverses ont les mêmes règles pour toutes les unités", () => {
  const g = setup();
  const u = trainUnit(g, 5, 5, "cavalry");
  nextOwnTurn(g);
  selectUnit(g, u.id);
  g.board[key(6, 5)] = { terrain: "mountain" };
  assert.throws(() => move(g, 6, 5));
  g.board[key(6, 5)] = { terrain: "river" };
  assert.throws(() => move(g, 6, 5));
  g.board[key(6, 5)].building = { type: "bridge", owner: 0 };
  move(g, 6, 5);
  g.players[1].units.push({
    id: 0,
    type: "cavalry",
    x: 7,
    y: 5,
    moves: 2,
    acted: false,
  });
  g.board[key(7, 5)] = { terrain: "plain" };
  assert.throws(() => move(g, 7, 5), /adverse/);
  selectUnit(g, null);
  g.players[0].x = 8;
  g.players[0].y = 5;
  assert.throws(() => move(g, 7, 5), /adverse/);
});
test("recruter un ouvrier conserve les déplacements et l’action de chaque unité", () => {
  const g = setup();
  g.board[key(2, 6)] = {
    terrain: "plain",
    building: { type: "house", owner: 0 },
  };
  const u = trainUnit(g, 5, 5, "cavalry");
  nextOwnTurn(g);
  selectUnit(g, u.id);
  recruit(g);
  g.board[key(6, 5)] = { terrain: "plain" };
  move(g, 6, 5);
  assert.equal(u.moves, 1);
  assert.equal(u.acted, false);
  selectUnit(g, null);
  g.board[key(1, 6)] = { terrain: "plain" };
  move(g, 1, 6);
  assert.equal(g.players[0].x, 1);
  assert.throws(() => recruit(g), /seul/);
});
test("les refus de recrutement sont atomiques : propriétaire, ressources, présence adverse et fin de partie", () => {
  for (const defect of ["owner", "resources", "occupied", "finished"]) {
    const g = setup();
    if (defect === "owner") g.board[key(5, 5)].building.owner = 1;
    if (defect === "resources") g.players[0].resources.iron = 0;
    if (defect === "occupied") {
      g.players[1].x = 5;
      g.players[1].y = 5;
    }
    if (defect === "finished") g.finished = true;
    const before = structuredClone(g);
    assert.ok(trainError(g, 5, 5, "cavalry"));
    assert.throws(() => trainUnit(g, 5, 5, "cavalry"));
    assert.deepEqual(g, before);
  }
});
test("la construction ne peut pas recouvrir une unité adverse dans son motif", () => {
  const g = setup();
  g.players[0].x = 10;
  g.players[0].y = 10;
  for (const [x, y] of [
    [10, 10],
    [9, 10],
    [11, 10],
    [10, 9],
    [10, 11],
  ])
    g.board[key(x, y)] = { terrain: "plain" };
  g.players[1].units.push({
    id: 0,
    type: "cavalry",
    x: 10,
    y: 11,
    moves: 2,
    acted: false,
  });
  g.buildingMarket[0] = "farm";
  assert.match(buildError(g, 0, 10, 10), /adverse/);
});
test("migration et sauvegarde conservent les unités, les quotas et le pion sélectionné", () => {
  const g = setup();
  const u = trainUnit(g, 5, 5, "cavalry");
  selectUnit(g, u.id);
  const saved = JSON.parse(JSON.stringify(g));
  migrateGame(saved);
  assert.deepEqual(saved, g);
  assert.equal(score(g, 0).units, 0);
  delete saved.players[0].units;
  delete saved.players[1].units;
  delete saved.selectedUnitId;
  delete saved.kingEnded;
  migrateGame(saved);
  assert.deepEqual(saved.players[0].units, []);
  assert.equal(saved.selectedUnitId, null);
});
