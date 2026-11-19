import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  RULES,
  key,
  move,
  moveError,
  placement,
  transformed,
  build,
  buildError,
  exploreError,
  assignWorker,
  migrateGame,
} from "../src/engine.js";
import { validateGame } from "../src/validation.js";
import { createUIState } from "../src/ui/state.js";
import { dragPreview } from "../src/ui/interactions.js";
import { escapeHTML, terrainDiagram } from "../src/ui/html.js";
import { playersView, rulesView, selectionView } from "../src/ui/views.js";

test("le plateau configuré est 13×13 et les rois partent au milieu des bords opposés", () => {
  const g = createGame();
  assert.equal(RULES.size, 13);
  assert.deepEqual(
    g.players.map((p) => [p.x, p.y]),
    [
      [0, 6],
      [12, 6],
    ],
  );
  assert.equal(g.boardSize, 13);
  assert.equal(validateGame(g), g);
});
test("coordonnées fractionnaires, angles et ancres invalides sont refusés sans mutation", () => {
  const g = createGame(),
    before = structuredClone(g);
  assert.throws(() => move(g, 0.5, 7.5));
  assert.equal(placement(g, 0, 1, 6, Infinity), null);
  assert.equal(placement(g, 0, 1, 6, 0, 99), null);
  assert.deepEqual(transformed(g.tileMarket[0], -1), []);
  g.board[key(1, 6)] = { terrain: "plain" };
  g.players[0].x = 1;
  g.buildingMarket[0] = "house";
  const snapshot = structuredClone(g);
  assert.throws(() => build(g, 0, 1, 6, 10));
  assert.deepEqual(g, snapshot);
  assert.equal(before.players[0].x, 0);
});
test("la disponibilité affichée respecte les obstacles et les actions de l’unité", () => {
  const g = createGame();
  g.board[key(1, 6)] = { terrain: "mountain" };
  assert.match(moveError(g, 1, 6), /infranchissable/);
  g.board[key(1, 6)] = { terrain: "plain" };
  g.players[1].x = 1;
  assert.match(moveError(g, 1, 6), /adverse/);
  g.players[1].x = 11;
  g.acted = true;
  assert.match(exploreError(g, 0, 0, 8), /terminé/);
});
test("une ressource absente ou non finie ne permet pas de construire à crédit", () => {
  for (const amount of [undefined, NaN]) {
    const g = createGame();
    g.board[key(1, 6)] = { terrain: "forest" };
    g.players[0].x = 1;
    g.players[0].resources.material = amount;
    g.buildingMarket[0] = "sawmill";
    const snapshot = structuredClone(g);
    assert.ok(buildError(g, 0, 1, 6));
    assert.throws(() => build(g, 0, 1, 6));
    assert.deepEqual(g, snapshot);
  }
});
test("un aperçu de marché épuisé est invalide sans modifier la partie", () => {
  const g = createGame();
  g.tileMarket = [];
  const before = structuredClone(g);
  assert.ok(
    dragPreview(g, { kind: "terrain", index: 0, rotation: 0 }, { x: 1, y: 6 })
      .error,
  );
  assert.deepEqual(g, before);
});

test("chaque aperçu de tuile affiche ses terrains et les textes sont échappés", () => {
  const tile = {
    cells: [
      { x: 0, y: 0, terrain: "plain" },
      { x: 1, y: 0, terrain: "forest" },
    ],
  };
  assert.ok(terrainDiagram(tile).includes("tile-diagram"));
  assert.equal(
    escapeHTML('<img src=x onerror="x">'),
    "&lt;img src=x onerror=&quot;x&quot;&gt;",
  );
  const g = createGame();
  g.players[0].name = "<img src=x>";
  assert.doesNotMatch(playersView(g), /<img src=x>/);
  assert.match(playersView(g), /&lt;img src=x&gt;/);
  assert.match(playersView(g), /&lt;img/);
  assert.match(rulesView(), /13 × 13/);
});
test("l’exploration est proposée sans déplacer l’unité ni révéler de cases", () => {
  const g = createGame(),
    ui = createUIState();
  g.tileMarket[0] = {
    cells: [
      { x: 0, y: 0, terrain: "plain" },
      { x: 1, y: 0, terrain: "forest" },
    ],
  };
  ui.selected = { x: 1, y: 7 };
  const before = structuredClone(g);
  assert.ok(
    dragPreview(g, { kind: "terrain", index: 0, rotation: 0 }, { x: 1, y: 6 })
      .cells.length,
  );
  assert.doesNotMatch(selectionView(g, ui), /explore-confirm|build-confirm/);
  assert.deepEqual(g, before);
});
test("un état de partie malformé est rejeté", () => {
  for (const change of [
    (g) => (g.players[0].resources.material = -1),
    (g) => (g.players[0].workerAssignments = []),
    (g) =>
      (g.board[key(1, 6)] = {
        terrain: "plain",
        overlay: { anchor: "404,404", role: "field" },
      }),
    (g) => g.tileMarket[0].cells.push(g.tileMarket[0].cells[0]),
  ]) {
    const g = createGame();
    change(g);
    assert.throws(() => validateGame(g), /État de partie invalide/);
  }
});
test("une affectation sans producteur et une sélection d’unité périmée sont réparées", () => {
  const g = createGame();
  g.board[key(2, 6)] = {
    terrain: "forest",
    building: { type: "sawmill", owner: 0 },
  };
  assignWorker(g, 0, 2, 6);
  g.board[key(2, 6)].building.type = "house";
  g.selectedUnitId = 42;
  migrateGame(g);
  assert.equal(g.players[0].workerAssignments[0].building, null);
  assert.equal(g.selectedUnitId, null);
});
