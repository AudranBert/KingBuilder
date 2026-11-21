import { prepareBuilding } from "./helpers.js";
import { placementGuidance } from "../src/ui/interactions.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, key, selectUnit, endTurn, actor } from "../src/engine.js";
import { dragFromCard, dragPreview, moveUnitTo, placementErrorText } from "../src/ui/interactions.js";
import { createUIState } from "../src/ui/state.js";

test("le bandeau garde seulement la cause du blocage et préfixe les erreurs", () => {
  assert.equal(placementErrorText("Moulin : terrain incompatible, il faut plaine ou champs à la place de montagne. Entrée sur plaine ou champ, voisine d’un champ allié ; deux cases de cour sur plaine."),
    "Cannot place: requires plain or fields here.");
  assert.equal(placementErrorText("Le motif sort du plateau."), "Cannot place: the tile extends beyond the board.");
  assert.equal(placementErrorText("Ressources insuffisantes : il manque 2 bois (or insuffisant)."),
    "Cannot place: insufficient resources: missing 2 wood (not enough gold).");
});

test("glisser le premier ouvrier suit un chemin de tpremier ouvriers cases et épuise ses déplacements", () => {
  const g = createGame();
  g.board[key(1, 6)] = { terrain: "forest" };
  g.board[key(2, 6)] = { terrain: "plain" };
  g.board[key(3, 6)] = { terrain: "plain" };
  const before = structuredClone(g);
  assert.deepEqual(dragPreview(g, { kind: "unit" }, { x: 3, y: 6 }), {
    cells: [
      { x: 1, y: 6 },
      { x: 2, y: 6 },
      { x: 3, y: 6 },
    ],
    error: null,
  });
  assert.deepEqual(g, before);
  moveUnitTo(g, 3, 6);
  assert.deepEqual(
    [actor(g).x, actor(g).y, g.players[g.active].units[0].moves, g.players[g.active].units[0].acted],
    [3, 6, 0, false],
  );
});
test("un dépôt inaccessible ne déplace pas partiellement le premier ouvrier", () => {
  for (const terrain of ["mountain", "river", null]) {
    const g = createGame();
    if (terrain) g.board[key(1, 6)] = { terrain };
    else delete g.board[key(1,6)];
    g.board[key(2, 6)] = { terrain: "plain" };
    const before = structuredClone(g);
    assert.ok(dragPreview(g, { kind: "unit" }, { x: 2, y: 6 }).error);
    assert.throws(() => moveUnitTo(g, 2, 6));
    assert.deepEqual(g, before);
  }
  const g = createGame();
  g.board[key(1, 6)] = { terrain: "plain" };
  g.players[g.active].units[0].ended = true;
  assert.throws(() => moveUnitTo(g, 1, 6));
});
test("glisser un second ouvrier sélectionné ne dépense pas les déplacements du premier ouvrier", () => {
  const g = createGame();
  g.board[key(5, 5)] = {
    terrain: "plain",
    building: { type: "house", owner: 0 },
  };
  g.board[key(6, 5)] = { terrain: "plain" };
  g.players[0].resources.gold = 1;
  const unit = g.players[0].units[1];Object.assign(unit,{x:5,y:5,moves:0,acted:true,ended:true});

  endTurn(g);
  endTurn(g);
  const drag = dragFromCard(
    { dataset: { unitDrag: String(unit.id) } },
    createUIState(),
  );
  selectUnit(g, drag.id);
  moveUnitTo(g, 6, 5);
  assert.equal(unit.moves, 2);
  assert.equal(g.players[g.active].units[0].moves, 3);
  assert.equal(unit.x, 6);
  assert.equal(
    dragFromCard({ dataset: { unitDrag: "" } }, createUIState()).id,
    null,
  );
});

test("les guides de placement respectent rotations, action, coût et terrains sans mutation", () => {
  const g = createGame();
  g.players[0].resources.food=3;
  g.buildingMarket = ["house"];
  prepareBuilding(g, "house", 1, 6);
  const choice = {kind: "building", index: 0, rotation: 0};
  const before = structuredClone(g);
  assert.equal(placementGuidance(g, choice).get("1,6").error, null);
  assert.deepEqual(g, before);
  g.players[0].resources.material = 0;
  g.players[0].resources.gold = 0;
  assert.match(dragPreview(g, choice, {x: 1, y: 6}).error, /3 materials/);
  g.players[0].resources.material = 2;
  g.board[key(1, 6)].terrain = "river";
  assert.match(dragPreview(g, choice, {x: 1, y: 6}).error, /incompatible terrain/);
  g.players[g.active].units[0].acted = true;
  assert.ok([...placementGuidance(g, choice).values()].every(result => result.error));
  g.players[g.active].units[0].acted = false;
  for (const rotation of [0, 1, 2, 3]) {
    const terrain = {kind: "terrain", index: 0, rotation};
    for (const [position, result] of placementGuidance(g, terrain)) {
      const [x, y] = position.split(",").map(Number);
      assert.deepEqual(result, dragPreview(g, terrain, {x, y}));
    }
  }
});
