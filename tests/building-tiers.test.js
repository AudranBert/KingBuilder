import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, BUILDINGS, build, key, rerollMarket, rerollError, migrateGame } from "../src/engine.js";
import { buildingMarketView } from "../src/ui/views.js";

test("tiers par famille et étoiles sur les cartes", () => {
  for (const b of Object.values(BUILDINGS)) {
    const family = b.family || b.id;
    const expected = ["mill", "barracks"].includes(family) ? 2
      : ["bridge", "clearing", "castle"].includes(family) ? 0 : 1;
    assert.equal(b.tier, expected, b.id);
  }
  const g = createGame();
  g.buildingMarket = ["bridge", "farm_z", "mill_l"];
  const html = buildingMarketView(g, { buildingRotation: 0 });
  assert.match(html, /aria-label="0 étoile">☆/);
  assert.match(html, /aria-label="1 étoile">★/);
  assert.match(html, /aria-label="2 étoiles">★★/);
});

test("le marché initial exclut les tiers 2 sans changer les 60 cartes", () => {
  for (let seed = 0; seed < 50; seed++) {
    let state = seed + 1;
    const g = createGame(() => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32));
    assert.equal(g.buildingMarket.length, 3);
    assert.ok(g.buildingMarket.every(id => BUILDINGS[id].tier < 2));
    const cards = [...g.buildingMarket, ...g.buildingDeck];
    assert.equal(cards.length, 60);
    assert.equal(cards.filter(id => BUILDINGS[id].tier === 2).length, 10);
    assert.equal(cards.filter(id => BUILDINGS[id].tier === 0).length, 14);
  }
});

test("le premier remplacement après construction écarte le tier 2 sans le perdre", () => {
  const g = createGame();
  g.buildingMarket[0] = "house";
  g.buildingDeck = ["mill", "barracks", "farm_t", "bridge"];
  g.board[key(1, 6)] = { terrain: "plain" };
  build(g, 0, 1, 6);
  assert.equal(g.buildingMarket[0], "farm_t");
  assert.deepEqual(g.buildingDeck, ["mill", "barracks", "bridge"]);
  assert.equal(g.buildingReplacements, 1);
  // The other kingdom makes the second purchase in this shared market.
  g.active = 1;
  g.moves = 2;
  g.kingEnded = false;
  g.acted = false;
  g.buildingMarket[1] = "house";
  g.board[key(10, 6)] = { terrain: "plain" };
  build(g, 1, 10, 6);
  assert.equal(g.buildingMarket[1], "mill");
  assert.equal(g.buildingReplacements, 2);
});

test("dès le deuxième remplacement chacun des trois tiers est autorisé", () => {
  for (const replacement of ["bridge", "farm_t", "barracks"]) {
    const g = createGame();
    g.buildingReplacements = 1;
    g.buildingMarket[0] = "house";
    g.buildingDeck.unshift(replacement);
    g.board[key(1, 6)] = { terrain: "plain" };
    build(g, 0, 1, 6);
    assert.equal(g.buildingMarket[0], replacement);
  }
});

test("la première relance exclut les tiers 2 et la deuxième les autorise", () => {
  const g = createGame();
  g.players[0].prestige = 5;
  g.buildingDeck = ["mill", "barracks", "house", "bridge", "farm_t"];
  const cards = [...g.buildingMarket, ...g.buildingDeck].sort();
  rerollMarket(g, "building");
  assert.deepEqual(g.buildingMarket, ["house", "bridge", "farm_t"]);
  assert.equal(g.buildingReplacements, 1);
  g.rerollsUsed = 0;
  rerollMarket(g, "building");
  assert.deepEqual(g.buildingMarket.slice(0, 2), ["mill", "barracks"]);
  assert.equal(g.buildingReplacements, 2);
  assert.deepEqual([...g.buildingMarket, ...g.buildingDeck].sort(), cards);
});

test("une relance de terrains ne débloque pas les bâtiments de tier 2", () => {
  const g = createGame();
  g.players[0].prestige = 5;
  rerollMarket(g, "terrain");
  assert.equal(g.buildingReplacements, 0);
});

test("une première relance sans assez de cartes éligibles est refusée sans mutation", () => {
  const g = createGame();
  g.players[0].prestige = 5;
  g.buildingDeck = ["mill", "barracks", "house"];
  const before = structuredClone(g);
  assert.match(rerollError(g, "building"), /tier 1 ou inférieur/);
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
