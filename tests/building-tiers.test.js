import { createSandboxGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDINGS, build, key, rerollMarket, rerollError, migrateGame } from "../src/engine.js";
import { buildingMarketView } from "../src/ui/views.js";

test("tiers par famille et étoiles sur les cartes", () => {
  for (const b of Object.values(BUILDINGS)) {
    const expected = ["bridge", "tunnel", "clearing"].includes(b.id) ? 0 : b.produces && (b.family || b.id) !== "port" ? 1 : 2;
    assert.equal(b.tier, expected, b.id);
  }
  const g = createGame();
  g.buildingMarket = ["bridge", "farm_z", "mill_l"];
  const html = buildingMarketView(g, { buildingRotation: 0 });
  assert.match(html, /aria-label="0 étoile">☆/);
  assert.match(html, /aria-label="1 étoile">★/);
  assert.match(html, /aria-label="2 étoiles">★★/);
});

test("le marché initial exclut les tiers 2 et conserve les 84 cartes", () => {
  for (let seed = 0; seed < 50; seed++) {
    let state = seed + 1;
    const g = createGame(() => ((state = (state * 1664525 + 1013404223) >>> 0) / 2 ** 32));
    assert.equal(g.buildingMarket.length, 4);
    assert.ok(g.buildingMarket.every(id => BUILDINGS[id].tier === 1));
    assert.equal(new Set(g.buildingMarket.map(id => BUILDINGS[id].family || id)).size, 4);
    const cards = [...g.buildingMarket, ...g.buildingDeck];
    assert.equal(cards.length, 84);
    assert.equal(cards.filter(id => id === "house").length, 7);
    assert.equal(cards.filter(id => id === "tunnel").length, 6);
    assert.equal(cards.filter(id => BUILDINGS[id].tier === 1).length, 30);
    assert.equal(cards.filter(id => BUILDINGS[id].tier === 2).length, 34);
    assert.equal(cards.filter(id => BUILDINGS[id].tier === 0).length, 20);
  }
});

test("le premier remplacement après construction écarte le tier 2 sans le perdre", () => {
  const g = createGame();
  g.players[0].resources.food = 3;
  g.buildingMarket[0] = "house";
  g.buildingDeck = ["mill", "barracks", "farm_t", "bridge"];
  g.board[key(1, 6)] = { terrain: "plain" };
  build(g, 0, 1, 6);
  assert.equal(g.buildingMarket[0], "farm_t");
  assert.deepEqual(g.buildingDeck, ["mill", "barracks", "bridge"]);
  assert.equal(g.buildingReplacements, 1);
  // The other kingdom makes the second purchase in this shared market.
  g.active = 1;
  g.players[g.active].units[0].moves = 3;
  g.players[g.active].units[0].ended = false;
  g.players[g.active].units[0].acted = false;
  g.players[1].resources.food=3;
  g.buildingMarket[1] = "house";
  g.board[key(11, 6)] = { terrain: "plain" };
  build(g, 1, 11, 6);
  assert.equal(g.buildingMarket[1], "mill");
  assert.equal(g.buildingReplacements, 2);
});

test("dès le deuxième remplacement chacun des trois tiers est autorisé", () => {
  for (const replacement of ["bridge", "farm_t", "barracks"]) {
    const g = createGame();
    g.buildingReplacements = 1;
    g.players[0].resources.food = 3;
  g.buildingMarket[0] = "house";
    g.buildingDeck.unshift(replacement);
    g.board[key(1, 6)] = { terrain: "plain" };
    build(g, 0, 1, 6);
    assert.equal(g.buildingMarket[0], replacement);
  }
});

test("la première relance exclut les tiers 2 et la deuxième les autorise", () => {
  const g = createGame();
  g.players[0].resources.gold = 5;
  g.buildingDeck = ["mill", "barracks", "sawmill", "bridge", "farm_t", "quarry"];
  const cards = [...g.buildingMarket, ...g.buildingDeck].sort();
  rerollMarket(g, "building");
  assert.deepEqual(g.buildingMarket, ["sawmill", "bridge", "farm_t", "quarry"]);
  assert.equal(g.buildingReplacements, 1);
  g.rerollsUsed = 0;
  rerollMarket(g, "building");
  assert.deepEqual(g.buildingMarket.slice(0, 2), ["mill", "barracks"]);
  assert.equal(g.buildingReplacements, 2);
  assert.deepEqual([...g.buildingMarket, ...g.buildingDeck].sort(), cards);
});

test("une relance de terrains ne débloque pas les bâtiments de tier 2", () => {
  const g = createGame();
  g.players[0].resources.gold = 5;
  rerollMarket(g, "terrain");
  assert.equal(g.buildingReplacements, 0);
});

test("une première relance sans assez de cartes éligibles est refusée sans mutation", () => {
  const g = createGame();
  g.players[0].resources.gold = 5;
  g.buildingDeck = ["mill", "barracks", "house", "farm_t"];
  const before = structuredClone(g);
  assert.match(rerollError(g, "building"), /tier 1 or lower/);
  assert.throws(() => rerollMarket(g, "building"));
  assert.deepEqual(g, before);
});

test("le compteur survit à la migration et les anciennes parties restent débloquées", () => {
  const g = createGame();
  g.buildingReplacements = 1;
  assert.equal(migrateGame(structuredClone(g)).buildingReplacements, 1);
  delete g.buildingReplacements;
  assert.equal(migrateGame(g).buildingReplacements, 2);
});
