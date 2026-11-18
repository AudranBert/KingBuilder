import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  key,
  selectUnit,
  trainUnit,
  endTurn,
  actor,
  assignWorker,
} from "../dist/engine.js";
import {
  dragFromCard,
  dragPreview,
  moveUnitTo,
} from "../dist/ui/interactions.js";
import { createUIState } from "../dist/ui/state.js";

test("glisser le roi suit un chemin de deux cases et dépense seulement ses déplacements", () => {
  const g = createGame();
  g.board[key(1, 6)] = { terrain: "forest" };
  g.board[key(2, 6)] = { terrain: "plain" };
  const before = structuredClone(g);
  assert.deepEqual(dragPreview(g, { kind: "unit" }, { x: 2, y: 6 }), {
    cells: [
      { x: 1, y: 6 },
      { x: 2, y: 6 },
    ],
    error: null,
  });
  assert.deepEqual(g, before);
  moveUnitTo(g, 2, 6);
  assert.deepEqual(
    [actor(g).x, actor(g).y, g.moves, g.acted],
    [2, 6, 0, false],
  );
});
test("un dépôt inaccessible ne déplace pas partiellement le roi", () => {
  for (const terrain of ["mountain", "river", null]) {
    const g = createGame();
    if (terrain) g.board[key(1, 6)] = { terrain };
    g.board[key(2, 6)] = { terrain: "plain" };
    const before = structuredClone(g);
    assert.ok(dragPreview(g, { kind: "unit" }, { x: 2, y: 6 }).error);
    assert.throws(() => moveUnitTo(g, 2, 6));
    assert.deepEqual(g, before);
  }
  const g = createGame();
  g.board[key(1, 6)] = { terrain: "plain" };
  g.acted = true;
  assert.throws(() => moveUnitTo(g, 1, 6));
});
test("glisser un cavalier sélectionné ne dépense pas les déplacements du roi", () => {
  const g = createGame();
  g.board[key(5, 5)] = {
    terrain: "plain",
    building: { type: "barracks", owner: 0 },
  };
  g.board[key(6, 5)] = { terrain: "plain" };
  g.players[0].resources.iron = 1;
  const unit = trainUnit(g, 5, 5, "cavalry");
  endTurn(g);
  endTurn(g);
  const drag = dragFromCard(
    { dataset: { unitDrag: String(unit.id) } },
    createUIState(),
  );
  selectUnit(g, drag.id);
  moveUnitTo(g, 6, 5);
  assert.equal(unit.moves, 1);
  assert.equal(g.moves, 2);
  assert.equal(unit.x, 6);
  assert.equal(
    dragFromCard({ dataset: { unitDrag: "" } }, createUIState()).id,
    null,
  );
});
test("l’aperçu ouvrier et le dépôt partagent les mêmes contraintes", () => {
  const g = createGame();
  g.board[key(2, 6)] = {
    terrain: "forest",
    building: { type: "sawmill", owner: 0 },
  };
  const drag = { kind: "worker", id: 0 };
  assert.equal(dragPreview(g, drag, { x: 2, y: 6 }).error, null);
  assignWorker(g, 0, 2, 6);
  const before = structuredClone(g);
  assert.ok(dragPreview(g, drag, { x: 3, y: 6 }).error);
  assert.throws(() => assignWorker(g, 0, 3, 6));
  assert.deepEqual(g, before);
});
