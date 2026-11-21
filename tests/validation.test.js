import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, key, move, placement, transformed, build, buildError } from "../src/engine.js";
import { validateGame } from "../src/validation.js";
import { dragPreview } from "../src/ui/interactions.js";
import { escapeHTML } from "../src/ui/html.js";
import { playersView } from "../src/ui/views.js";

test("coordonnées fractionnaires, angles et ancres invalides sont refusés sans mutation", () => {
  const g = createGame(),
    before = structuredClone(g);
  assert.throws(() => move(g, 0.5, 7.5));
  assert.equal(placement(g, 0, 1, 6, Infinity), null);
  assert.equal(placement(g, 0, 1, 6, 0, 99), null);
  assert.deepEqual(transformed(g.tileMarket[0], -1), []);
  g.board[key(1, 6)] = { terrain: "plain" };
  g.players[0].units[0].x = 1;
  g.buildingMarket[0] = "house";
  const snapshot = structuredClone(g);
  assert.throws(() => build(g, 0, 1, 6, 10));
  assert.deepEqual(g, snapshot);
  assert.equal(before.players[0].units[0].x, 0);
});

test("une ressource absente ou non finie ne permet pas de construire à crédit", () => {
  for (const amount of [undefined, NaN]) {
    const g = createGame();
    g.board[key(1, 6)] = { terrain: "forest" };
    g.players[0].units[0].x = 1;
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

test("les noms des joueurs et les textes HTML sont échappés", () => {
  assert.equal(
    escapeHTML('<img src=x onerror="x">'),
    "&lt;img src=x onerror=&quot;x&quot;&gt;",
  );
  const g = createGame();
  g.players[0].name = "<img src=x>";
  assert.doesNotMatch(playersView(g), /<img src=x>/);
  assert.match(playersView(g), /&lt;img src=x&gt;/);
});

test("un état de partie malformé est rejeté", () => {
  for (const change of [
    (g) => (g.players[0].resources.material = -1),
    (g) => (g.players[0].workers = 99),
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
