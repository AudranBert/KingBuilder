import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  key,
  build,
  buildError,
  buildingPattern,
  patternAt,
  score,
  assign,
  endTurn,
  productionAmount,
  buildingAt,
  move,
  migrateGame,
  BUILDINGS,
} from "../src/engine.js";
function setup(type, rotation = 0) {
  const g = createGame();
  g.players[0].resources = { wood: 7, wheat: 7, stone: 7, iron: 0 };
  g.players[0].x = 7;
  g.players[0].y = 7;
  g.buildingMarket[0] = type;
  for (const c of patternAt(type, 7, 7, rotation))
    g.board[key(c.x, c.y)] = { terrain: c.terrain[0] };
  return g;
}
test("construction : case de l’unité ou voisine par un bord pour tous les bâtiments", () => {
  for (const type of Object.keys(BUILDINGS).filter((id) => (BUILDINGS[id].family || id) !== "mill" && BUILDINGS[id].constructible !== false)) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const g = setup(type);
      g.players[0].x = 7 + dx;
      g.players[0].y = 7 + dy;
      assert.equal(buildError(g, 0, 7, 7), null, `${type}: ${dx},${dy}`);
      build(g, 0, 7, 7);
      assert.equal(g.acted, true);
    }
    for (const [dx, dy] of [[1, 1], [-1, -1], [2, 0], [0, -2]]) {
      const g = setup(type);
      g.players[0].x = 7 + dx;
      g.players[0].y = 7 + dy;
      assert.match(buildError(g, 0, 7, 7), /case\(s\) maximum/, type);
      const before = structuredClone(g);
      assert.throws(() => build(g, 0, 7, 7));
      assert.deepEqual(g, before);
    }
  }
  const g = farmAndMill();
  g.players[0].x = 9;
  assert.equal(buildError(g, 0, 8, 8), null);
  build(g, 0, 8, 8);
});
test("ferme : cinq plaines deviennent une seule tuile de ferme et quatre champs", () => {
  const g = setup("farm");
  build(g, 0, 7, 7);
  assert.equal(g.board[key(7, 7)].building.type, "farm");
  for (const [x, y] of [
    [7, 6],
    [8, 7],
    [7, 8],
    [6, 7],
  ]) {
    assert.equal(g.board[key(x, y)].overlay.role, "field");
    assert.equal(g.board[key(x, y)].terrain, "field");
    assert.equal(buildingAt(g, x, y).building.type, "farm");
  }
  assert.equal(score(g, 0).buildings, 2);
  assert.equal(score(g, 0).tiles, 0);
});
test("motifs refusés atomiquement sur inconnu, mauvais terrain, bâtiment ou chevauchement", () => {
  for (const defect of ["unknown", "wrong", "building", "overlay"]) {
    const g = setup("farm");
    const c = g.board[key(8, 7)];
    if (defect === "unknown") delete g.board[key(8, 7)];
    if (defect === "wrong") c.terrain = "forest";
    if (defect === "building") c.building = { type: "house", owner: 1 };
    if (defect === "overlay")
      c.overlay = { anchor: key(0, 9), role: "field", owner: 0 };
    const before = structuredClone(g);
    assert.throws(() => build(g, 0, 7, 7));
    assert.deepEqual(g, before);
  }
});
test("mine : plaine d’accès et trois montagnes, dans chacune des quatre orientations", () => {
  for (let r = 0; r < 4; r++) {
    const g = setup("mine", r);
    assert.equal(buildError(g, 0, 7, 7, r), null);
    build(g, 0, 7, 7, r);
    assert.equal(g.board[key(7, 7)].terrain, "plain");
    assert.equal(
      Object.values(g.board).filter((c) => c.overlay?.role === "mine").length,
      3,
    );
    assert.equal(g.board[key(7, 7)].building.rotation, r);
    assign(g, 7, 7);
    const iron = g.players[0].resources.iron;
    endTurn(g);
    assert.equal(g.players[0].resources.iron, iron + 1);
  }
});
test("variantes carrées : quatre terrains réservés, rotation et production", () => {
  for (const [type, role, resource] of [["mine_square", "mine", "iron"], ["port_square", "water", "wheat"]]) {
    for (let r = 0; r < 4; r++) {
      const g = setup(type, r);
      const parts = patternAt(type, 7, 7, r).filter(c => c.role === role);
      assert.equal(parts.length, 4);
      assert.equal(new Set(parts.map(c => c.x)).size, 2);
      assert.equal(new Set(parts.map(c => c.y)).size, 2);
      build(g, 0, 7, 7, r);
      for (const c of parts) assert.equal(g.board[key(c.x, c.y)].overlay.role, role);
      assign(g, 7, 7);
      const before = g.players[0].resources[resource];
      endTurn(g);
      assert.equal(g.players[0].resources[resource], before + 1);
    }
  }
});
test("ferme en Z et scierie en croix : rotations, réservation et production", () => {
  for (const [type, role, resource] of [["farm_z", "field", "wheat"], ["sawmill_cross", "timber", "wood"]]) {
    for (let r = 0; r < 4; r++) {
      const g = setup(type, r);
      const parts = patternAt(type, 7, 7, r).filter(c => c.role !== "building");
      assert.equal(parts.length, 4);
      const invalid = structuredClone(g);
      invalid.board[key(parts[0].x, parts[0].y)].terrain = "river";
      assert.throws(() => build(invalid, 0, 7, 7, r));
      build(g, 0, 7, 7, r);
      for (const c of parts) {
        assert.equal(g.board[key(c.x, c.y)].overlay.role, role);
        assert.equal(buildingAt(g, c.x, c.y).building.type, type);
      }
      assign(g, 7, 7);
      const before = g.players[0].resources[resource];
      endTurn(g);
      assert.equal(g.players[0].resources[resource], before + 1);
    }
  }
});
test("le moulin reconnaît et bonifie la ferme en Z", () => {
  const g = setup("farm_z");
  build(g, 0, 7, 7);
  assign(g, 7, 7);
  endTurn(g);
  endTurn(g);
  g.players[0].x = 8;
  g.players[0].y = 7;
  g.board[key(8, 7)] = { terrain: "plain" };
  g.buildingMarket[0] = "mill";
  assert.equal(buildError(g, 0, 8, 7), null);
  build(g, 0, 8, 7);
  assert.equal(productionAmount(g, 7, 7), 2);
});
test("nouvelles variantes : les quatre orientations réservent tout le motif", () => {
  for (const type of ["farm_t", "sawmill_l", "quarry_ridge", "mine_l", "port_l"]) {
    for (let r = 0; r < 4; r++) {
      const g = setup(type, r);
      const parts = patternAt(type, 7, 7, r);
      build(g, 0, 7, 7, r);
      for (const c of parts) assert.equal(buildingAt(g, c.x, c.y).building.type, type);
      assign(g, 7, 7);
      assert.equal(productionAmount(g, 7, 7), 1);
    }
  }
});
test("les trois moulins gardent les mêmes contraintes et le même bonus", () => {
  for (const type of ["mill", "mill_line", "mill_l"]) {
    for (let r = 0; r < 4; r++) {
      const g = setup(type, r);
      assert.throws(() => build(g, 0, 7, 7, r));
      const reserved = new Set(patternAt(type, 7, 7, r).map(c => key(c.x, c.y)));
      const [dx, dy] = [[-1, 0], [1, 0], [0, -1], [0, 1]].find(([x, y]) =>
        !reserved.has(key(7 + x, 7 + y)) && !reserved.has(key(7 + x + y, 7 + y + x)));
      const fx = 7 + dx + dy, fy = 7 + dy + dx;
      g.board[key(fx, fy)] = { terrain: "plain", building: {type: "farm_z", owner: 0} };
      g.board[key(7 + dx, 7 + dy)] = { terrain: "field", overlay: {anchor: key(fx, fy), role: "field", owner: 0} };
      g.players[0].workerAssignments[0].building = key(fx, fy);
      build(g, 0, 7, 7, r);
      assert.equal(productionAmount(g, fx, fy), 2);
    }
  }
});
test("les carrières exigent leur terrain propre", () => {
  for (const type of ["quarry", "quarry_mountain"]) {
    for (const terrain of ["plain", "mountain", "forest", "river"]) {
      const g = setup(type);
      g.board[key(7, 7)].terrain = terrain;
      assert.equal(buildError(g, 0, 7, 7) === null,
        terrain === (type === "quarry" ? "plain" : "mountain"));
    }
  }
});
test("une mine ne se place pas sur une montagne ni dans une orientation incorrecte", () => {
  const g = setup("mine");
  assert.throws(() => build(g, 0, 7, 7, 1));
  g.board[key(7, 7)].terrain = "mountain";
  assert.throws(() => build(g, 0, 7, 7));
});
test("port : plaine et trois eaux sur un côté, rotation et eau toujours infranchissable", () => {
  for (let r = 0; r < 4; r++) {
    const g = setup("port", r);
    build(g, 0, 7, 7, r);
    assert.equal(g.board[key(7, 7)].building.type, "port");
    assert.equal(
      Object.values(g.board).filter((c) => c.overlay?.role === "water").length,
      3,
    );
    endTurn(g);
    endTurn(g);
    const water = patternAt("port", 7, 7, r).find(
      (c) =>
        c.role === "water" && Math.abs(c.x - 7) + Math.abs(c.y - 7) === 1,
    );
    assert.throws(() => move(g, water.x, water.y));
  }
});
test("défricher gratuitement donne deux bois, consomme son action et remplace le marché", () => {
  const g = setup("clearing"),
    wood = g.players[0].resources.wood,
    next = g.buildingDeck.find(id => BUILDINGS[id].tier < 2);
  g.players[0].resources.wheat = 0;
  const points = score(g, 0).buildings;
  build(g, 0, 7, 7);
  assert.equal(g.board[key(7, 7)].terrain, "plain");
  assert.equal(g.board[key(7, 7)].building, undefined);
  assert.equal(g.players[0].resources.wood, wood + 2);
  assert.equal(g.players[0].resources.wheat, 0);
  assert.equal(g.acted, true);
  assert.equal(g.buildingMarket[0], next);
  assert.equal(score(g, 0).buildings, points);
  endTurn(g);
  endTurn(g);
  g.buildingMarket[0] = "house";
  build(g, 0, 7, 7);
});
function farmAndMill() {
  const g = setup("farm");
  build(g, 0, 7, 7);
  assign(g, 7, 7);
  endTurn(g);
  endTurn(g);
  g.players[0].x = 8;
  g.players[0].y = 8;
  g.board[key(8, 8)] = { terrain: "plain" };
  g.buildingMarket[0] = "mill";
  return g;
}
test("moulin : touche un champ et la ferme en diagonale ; double la récolte réelle", () => {
  const g = farmAndMill();
  assert.equal(buildError(g, 0, 8, 8), null);
  build(g, 0, 8, 8);
  assert.equal(productionAmount(g, 7, 7), 2);
  const before = g.players[0].resources.wheat;
  endTurn(g);
  assert.equal(g.players[0].resources.wheat, before + 2);
});
test("moulin : aucun cumul et aucune production sans ouvrier", () => {
  const g = farmAndMill();
  build(g, 0, 8, 8);
  g.board[key(6, 6)] = {
    terrain: "plain",
    building: { type: "mill", owner: 0 },
  };
  assert.equal(productionAmount(g, 7, 7), 2);
  g.players[0].workerAssignments[0].building = null;
  assert.equal(productionAmount(g, 7, 7), 0);
});
test("moulin : refus sans champ ou avec ferme ennemie ; ne bonifie pas l’adversaire", () => {
  const g = setup("mill");
  assert.throws(() => build(g, 0, 7, 7));
  const h = farmAndMill();
  h.board[key(7, 7)].building.owner = 1;
  assert.throws(() => build(h, 0, 8, 8));
  h.board[key(8, 8)].building = { type: "mill", owner: 0 };
  h.players[1].workerAssignments[0].building = key(7, 7);
  assert.equal(productionAmount(h, 7, 7), 1);
});
test("tuiles aux bords, roi adverse et ressources insuffisantes sont bloqués", () => {
  const g = setup("farm");
  assert.match(buildError(g, 0, 0, 0), /plateau|explorées/);
  g.players[1].x = 8;
  g.players[1].y = 7;
  assert.match(buildError(g, 0, 7, 7), /adverse/);
  g.players[1].x = 11;
  g.players[0].resources.wood = 0;
  assert.match(buildError(g, 0, 7, 7), /insuffisantes/);
});
test("tous les bâtiments sont dans la pioche et les anciennes parties restent jouables", () => {
  const g = createGame(() => 0.5);
  assert.deepEqual(
    new Set([...g.buildingMarket, ...g.buildingDeck]),
    new Set(Object.keys(BUILDINGS).filter(id => BUILDINGS[id].constructible !== false)),
  );
  g.version = 1;
  const old = structuredClone(g.board);
  migrateGame(g);
  assert.equal(g.version, 4);
  assert.deepEqual(g.board, old);
  const n = g.buildingDeck.length;
  migrateGame(g);
  assert.equal(g.buildingDeck.length, n);
  assert.equal(buildingPattern("mine").length, 4);
});

test("champs : conversion des anciennes fermes et moulin refusé sur de simples plaines", () => {
  const g = farmAndMill();
  for (const cell of Object.values(g.board)) {
    if (cell.overlay?.role === "field") cell.terrain = "plain";
  }
  assert.ok(buildError(g, 0, 8, 8));
  migrateGame(g);
  for (const cell of Object.values(g.board)) {
    if (cell.overlay?.role === "field") assert.equal(cell.terrain, "field");
  }
  assert.equal(buildError(g, 0, 8, 8), null);
});
