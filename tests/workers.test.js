import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  key,
  move,
  assign,
  assignWorker,
  productionAmount,
  recruit,
  endTurn,
  score,
  migrateGame,
  build,
  assigned,
} from "../src/engine.js";
function producer(g, x, y, type = "sawmill", owner = 0) {
  g.board[key(x, y)] = {
    terrain: type === "sawmill" ? "forest" : "mountain",
    building: { type, owner },
  };
}
test("départ : ressources conservées et un ouvrier libre, sans position ni déplacements", () => {
  const g = createGame();
  for (const p of g.players) {
    assert.deepEqual(p.resources, { wood: 2, wheat: 1, stone: 2, iron: 0 });
    assert.deepEqual(p.workerAssignments, [{ id: 0, building: null }]);
    assert.equal(p.workerPawns, undefined);
  }
  assert.equal(score(g, 0).resources, 1);
});
test("affectation lointaine et réaffectation immédiate sans trajet ni dépense du roi", () => {
  const g = createGame();
  producer(g, 9, 9);
  producer(g, 3, 3, "quarry");
  const king = [g.players[0].x, g.players[0].y],
    resources = { ...g.players[0].resources };
  assignWorker(g, 0, 9, 9);
  assert.equal(productionAmount(g, 9, 9), 1);
  assignWorker(g, 0, 3, 3);
  assert.equal(productionAmount(g, 9, 9), 0);
  assert.equal(productionAmount(g, 3, 3), 1);
  assert.deepEqual([g.players[0].x, g.players[0].y], king);
  assert.deepEqual(g.players[0].resources, resources);
  assert.equal(g.moves, 2);
  assert.equal(g.acted, false);
  assert.equal(assigned(g, 0), 1);
});
test("réaffectations illimitées et libération dans le même tour", () => {
  const g = createGame();
  producer(g, 2, 2);
  producer(g, 9, 9);
  for (let i = 0; i < 10; i++)
    assignWorker(g, 0, i % 2 ? 2 : 9, i % 2 ? 2 : 9);
  assignWorker(g, 0, null, null);
  assert.equal(assigned(g, 0), 0);
  assert.equal(productionAmount(g, 2, 2), 0);
  assert.equal(productionAmount(g, 9, 9), 0);
});
test("un ouvrier par bâtiment ; refus du terrain vide, des bâtiments passifs et adverses", () => {
  const g = createGame();
  recruit(g);
  producer(g, 9, 9);
  assignWorker(g, 0, 9, 9);
  const before = structuredClone(g);
  assert.throws(() => assignWorker(g, 1, 9, 9));
  assert.throws(() => assignWorker(g, 1, 5, 5));
  assert.throws(() => assignWorker(g, 1, 0, 6));
  producer(g, 4, 4, "quarry", 1);
  assert.throws(() => assignWorker(g, 1, 4, 4));
  delete g.board[key(4, 4)];
  assert.deepEqual(g, before);
});
test("seules les affectations finales produisent ; le transfert ne récolte rien immédiatement", () => {
  const g = createGame();
  producer(g, 9, 9);
  producer(g, 3, 3, "quarry");
  assignWorker(g, 0, 9, 9);
  assignWorker(g, 0, 3, 3);
  const wood = g.players[0].resources.wood,
    stone = g.players[0].resources.stone;
  endTurn(g);
  assert.equal(g.players[0].resources.wood, wood);
  assert.equal(g.players[0].resources.stone, stone + 1);
});
test("nouvel ouvrier immédiatement affectable après recrutement et action du roi", () => {
  const g = createGame();
  g.board[key(0, 5)] = { terrain: "forest" };
  g.players[0].y = 5;
  g.buildingMarket[0] = "sawmill";
  build(g, 0, 0, 5);
  recruit(g);
  assignWorker(g, 1, 0, 5);
  assert.equal(productionAmount(g, 0, 5), 1);
  assert.equal(g.players[0].resources.wheat, 0);
  assert.equal(g.players[0].workers, 2);
  assert.throws(() => recruit(g));
  endTurn(g);
  assert.equal(g.players[0].resources.wood, 3);
});
test("bouton du bâtiment affecte un libre, libère, et refuse de créer un ouvrier", () => {
  const g = createGame();
  producer(g, 9, 9);
  producer(g, 3, 3);
  assign(g, 9, 9);
  assert.throws(() => assign(g, 3, 3));
  assign(g, 9, 9);
  assign(g, 3, 3);
  assert.equal(productionAmount(g, 3, 3), 1);
  assert.equal(g.players[0].workers, 1);
});
test("les ouvriers ne bloquent pas le roi et ne nécessitent pas de terrain praticable", () => {
  const g = createGame();
  producer(g, 1, 6);
  assignWorker(g, 0, 1, 6);
  g.players[1].x = 2;
  g.players[1].y = 6;
  g.active = 1;
  move(g, 1, 6);
  assert.equal(g.players[1].x, 1);
  g.active = 0;
  producer(g, 9, 9, "quarry");
  assignWorker(g, 0, 9, 9);
  assert.equal(productionAmount(g, 9, 9), 1);
});
test("cliquer une partie auxiliaire affecte bien le bâtiment principal", () => {
  const g = createGame();
  producer(g, 10, 10);
  g.board[key(10, 6)] = {
    terrain: "plain",
    overlay: { anchor: key(10, 10), owner: 0, role: "field" },
  };
  assignWorker(g, 0, 10, 6);
  assert.equal(g.players[0].workerAssignments[0].building, key(10, 10));
});
test("aucune affectation après la fin de partie", () => {
  const g = createGame();
  producer(g, 9, 9);
  g.finished = true;
  assert.throws(() => assignWorker(g, 0, 9, 9));
  assert.throws(() => assignWorker(g, 0, null, null));
});
test("migration v3 : production conservée, pions en route libérés, ressources inchangées", () => {
  const g = createGame();
  g.version = 3;
  g.players[0].workers = 2;
  g.players[0].resources.wood = 17;
  producer(g, 9, 9);
  g.players[0].workerPawns = [
    { id: 0, x: 9, y: 9, moves: 0 },
    { id: 1, x: 4, y: 4, moves: 1 },
  ];
  g.players[1].workerPawns = [{ id: 0, x: 14, y: 7, moves: 2 }];
  delete g.players[0].workerAssignments;
  delete g.players[1].workerAssignments;
  migrateGame(g);
  assert.equal(g.version, 4);
  assert.deepEqual(g.players[0].workerAssignments, [
    { id: 0, building: key(9, 9) },
    { id: 1, building: null },
  ]);
  assert.equal(g.players[0].workerPawns, undefined);
  assert.equal(g.players[0].resources.wood, 17);
  assert.equal(productionAmount(g, 9, 9), 1);
  const saved = JSON.parse(JSON.stringify(g));
  migrateGame(saved);
  assert.deepEqual(saved, g);
});
test("migration v2 : ouvriers affectés conservés et population respectée", () => {
  const g = createGame();
  g.version = 2;
  g.players[0].workers = 2;
  producer(g, 9, 9);
  g.board[key(9, 9)].building.worker = true;
  migrateGame(g);
  assert.equal(g.players[0].workerAssignments.length, 2);
  assert.equal(productionAmount(g, 9, 9), 1);
  assert.equal(assigned(g, 0), 1);
});
