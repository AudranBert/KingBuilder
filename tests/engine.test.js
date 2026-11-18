import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  key,
  move,
  explore,
  build,
  recruit,
  assign,
  endTurn,
  score,
  placement,
  RULES,
  housing,
} from "../src/engine.js";
test("12×12, deux rois, marchés communs et châteaux initiaux hors pioche", () => {
  const g = createGame();
  assert.equal(g.players[1].x, 11);
  assert.equal(g.tileMarket.length, 3);
  assert.equal(g.buildingMarket.length, 3);
  assert.equal(Object.keys(g.board).length, 2);
  assert.equal(score(g, 0).tiles, 0);
  for (let i = 0; i < 2; i++) {
    const p = g.players[i];
    assert.equal(g.board[key(p.x, p.y)].building.type, "castle");
    assert.equal(housing(g, i), 2);
  }
  assert.equal(g.buildingDeck.length + g.buildingMarket.length, 60);
  assert.ok(![...g.buildingDeck, ...g.buildingMarket].includes("castle"));
  g.board[key(1, 6)] = { terrain: "plain" };
  g.buildingMarket[0] = "castle";
  const before = structuredClone(g);
  assert.throws(() => build(g, 0, 1, 6), /réservé au départ/);
  assert.deepEqual(g, before);
});
test("exploration atomique, attribution des cases et remplacement", () => {
  const g = createGame();
  g.tileMarket[0] = {
    cells: [
      { x: 0, y: 0, terrain: "plain" },
      { x: 1, y: 0, terrain: "forest" },
      { x: 1, y: 1, terrain: "mountain" },
    ],
  };
  assert.equal(move(g, 1, 6), "explore");
  explore(g, 0, 1, 6);
  assert.equal(g.players[0].revealed, 3);
  assert.equal(g.players[0].x, 0);
  assert.equal(g.acted, true);
  assert.equal(g.tileMarket.length, 3);
  assert.equal(score(g, 0).tiles, 3);
  assert.throws(() => explore(g, 0, 2, 6));
});
test("pas de chevauchement, pas de sortie et entrée praticable", () => {
  const g = createGame();
  g.tileMarket[0] = {
    cells: [
      { x: 0, y: 0, terrain: "plain" },
      { x: 1, y: 0, terrain: "river" },
    ],
  };
  assert.equal(placement(g, 0, 0, 6), null);
  assert.equal(placement(g, 0, 14, 0), null);
  assert.equal(placement(g, 0, 1, 6, 0, 1), null);
});
test("déplacements : deux cases, aucun saut, rivière et montagne bloquées", () => {
  const g = createGame();
  g.board[key(1, 6)] = { terrain: "plain" };
  g.board[key(2, 6)] = { terrain: "forest" };
  g.board[key(3, 6)] = { terrain: "plain" };
  g.board[key(0, 6)] = { terrain: "river" };
  assert.throws(() => move(g, 0, 6));
  assert.throws(() => move(g, 2, 6));
  move(g, 1, 6);
  move(g, 2, 6);
  assert.throws(() => move(g, 3, 6));
});
test("construction, paiement, recrutement, affectation et production", () => {
  const g = createGame();
  g.players[0].x = 5;
  g.players[0].y = 5;
  for (const [x, y] of [
    [5, 5],
    [4, 5],
    [6, 5],
    [5, 4],
    [5, 6],
  ])
    g.board[key(x, y)] = { terrain: "plain" };
  g.buildingMarket[0] = "farm";
  const before = g.players[0].resources.wood;
  build(g, 0, 5, 5);
  assert.equal(g.players[0].resources.wood, before - 1);
  recruit(g);
  assert.equal(g.players[0].workers, 2);
  assert.throws(() => recruit(g));
  assign(g, 5, 5);
  const wheat = g.players[0].resources.wheat;
  endTurn(g);
  assert.equal(g.players[0].resources.wheat, wheat + 1);
  assert.equal(g.active, 1);
  assert.equal(g.round, 1);
});
test("construction impossible sans terrain ou ressources correctes ne débite rien", () => {
  const g = createGame();
  g.board[key(1, 6)] = { terrain: "forest" };
  move(g, 1, 6);
  g.buildingMarket[0] = "farm";
  const before = structuredClone(g);
  assert.throws(() => build(g, 0, 1, 6));
  assert.deepEqual(g, before);
  g.buildingMarket[0] = "house";
  g.players[0].resources.wood = 0;
  assert.throws(() => build(g, 0, 1, 6));
});
test("ouvrier sur un bâtiment et pont traversable", () => {
  const g = createGame();
  g.board[key(1, 6)] = {
    terrain: "forest",
    building: { type: "sawmill", owner: 0 },
  };
  assign(g, 1, 6);
  g.board[key(0, 7)] = { terrain: "river" };
  g.buildingMarket[0] = "bridge";
  build(g, 0, 0, 7);
  endTurn(g);
  endTurn(g);
  move(g, 0, 7);
  assert.equal(g.players[0].y, 7);
});
test("capacité des maisons et interdiction de construire après recrutement", () => {
  const g = createGame();
  recruit(g);
  assert.throws(() => build(g, 0, 0, 6));
  endTurn(g);
  endTurn(g);
  assert.throws(() => recruit(g));
});
test("40 tours individuels, production finale et score détaillé", () => {
  const g = createGame();
  g.board[key(1, 6)] = {
    terrain: "plain",
    building: { type: "farm", owner: 1, worker: true },
  };
  g.players[1].workerAssignments[0].building = key(1, 6);
  const wheat = g.players[1].resources.wheat;
  for (let i = 0; i < 39; i++) endTurn(g);
  assert.equal(g.finished, false);
  assert.equal(g.round, RULES.rounds);
  assert.equal(g.active, 1);
  endTurn(g);
  assert.equal(g.finished, true);
  assert.equal(g.players[1].resources.wheat, wheat + 20);
  assert.equal(score(g, 1).buildings, 2);
  assert.equal(score(g, 1).workers, 2);
  assert.throws(() => endTurn(g));
});

test("explorer une montagne après deux déplacements ne déplace pas le roi", () => {
 const g=createGame(); g.tileMarket[0]={cells:[{x:0,y:0,terrain:"mountain"},{x:1,y:0,terrain:"river"}]};
 g.moves=0; explore(g,0,1,6); assert.equal(g.players[0].x,0); assert.equal(g.players[0].y,6);
 assert.equal(g.board[key(1,6)].terrain,"mountain"); assert.equal(g.board[key(2,6)].terrain,"river"); assert.equal(g.players[0].revealed,2);
});

test("le contact peut se faire sur une autre case que l’origine du motif", () => {
 const g=createGame();g.players[0].x=5;g.players[0].y=5;g.board[key(5,5)]={terrain:"plain"};
 g.tileMarket[0]={cells:[{x:0,y:0,terrain:"river"},{x:1,y:0,terrain:"mountain"},{x:2,y:0,terrain:"forest"}]};
 explore(g,0,3,6);assert.equal(g.players[0].x,5);assert.equal(g.players[0].y,5);assert.equal(g.players[0].revealed,3);
});

test("les déplacements accessibles suivent les chemins et le budget de l’unité", async () => {
 const {movementPaths,selectUnit}=await import("../src/engine.js");
 const g=createGame();g.board[key(1,6)]={terrain:"plain"};g.board[key(2,6)]={terrain:"forest"};g.board[key(0,5)]={terrain:"mountain"};
 let paths=movementPaths(g);assert.equal(paths.get(key(2,6)).length,2);assert.equal(paths.has(key(0,5)),false);assert.equal(paths.has(key(1,5)),false);
 move(g,1,6);paths=movementPaths(g);assert.equal(paths.get(key(2,6)).length,1);assert.equal(paths.has(key(3,6)),false);
 g.acted=true;assert.equal(movementPaths(g).size,0);
 g.players[0].units.push({id:0,type:"cavalry",x:2,y:6,moves:2,acted:false,ended:false});selectUnit(g,0);assert.equal(movementPaths(g).get(key(0,6)).length,2);
});

test("explorer ou construire termine l’activation du roi et du cavalier", async () => {
 const {selectUnit,actor,movementPaths}=await import("../src/engine.js");
 for(const cavalry of [false,true]) for(const action of ["explore","build"]) for(const before of [0,1,2]) {
  const g=createGame();g.players[0].x=5;g.players[0].y=5;
  for(let x=5;x<=8;x++) g.board[key(x,5)]={terrain:"plain"};
  g.players[0].resources.wood=10;g.players[0].resources.stone=10;
  if(cavalry) {g.players[0].units.push({id:0,type:"cavalry",x:5,y:5,moves:2,acted:false,ended:false});selectUnit(g,0);}
  for(let step=0;step<before;step++) move(g,6+step,5);
  const x=actor(g).x;
  g.tileMarket[0]={cells:[{x:0,y:0,terrain:"forest"}]};g.buildingMarket[0]="house";
  if(action==="explore") explore(g,0,x,6);else build(g,0,x,5);
  assert.equal(actor(g).moves,0);assert.equal(actor(g).acted,true);
  assert.throws(()=>explore(g,0,x,4));assert.throws(()=>build(g,0,x,5));
  assert.throws(()=>move(g,x+1,5));
  assert.equal(actor(g).moves,0);assert.equal(movementPaths(g).size,0);assert.throws(()=>move(g,8,5));
  endTurn(g);endTurn(g);if(cavalry) selectUnit(g,0);
  assert.equal(actor(g).moves,2);assert.equal(actor(g).acted,false);
 }
});
