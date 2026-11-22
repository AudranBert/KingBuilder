import { createSandboxGame as createGame, prepareBuilding } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDINGS, build, rerollMarket, rerollError } from "../src/engine.js";
import { BUILDING_CONFIGURATION } from "../src/configuration.js";

test("le marché initial exclut les tiers 2 et conserve chaque exemplaire configuré", () => {
  for (let seed = 0; seed < 50; seed++) {
    let state = seed + 1;
    const g = createGame(() => ((state = (state * 1664525 + 1013404223) >>> 0) / 2 ** 32));
    assert.equal(g.buildingMarket.length, 5);
    assert.ok(g.buildingMarket.every(id => BUILDINGS[id].tier === 1));
    assert.equal(new Set(g.buildingMarket.map(id => BUILDINGS[id].family || id)).size, 5);
    const cards = [...g.buildingMarket, ...g.buildingDeck];
    const expected = BUILDING_CONFIGURATION.buildings.flatMap(b => Array(b.constructible === false ? 0 : b.weight).fill(b.id));
    assert.deepEqual(cards.sort(), expected.sort());
  }
});

test("le premier remplacement après construction écarte le tier 2 sans le perdre", () => {
  const g = createGame();
  g.players[0].resources={food:4,material:4,gold:1};
  g.buildingMarket[0] = "house";
  g.buildingDeck = ["mill", "barracks", "farm_t", "bridge"];
  prepareBuilding(g, "house", 1, 6);
  build(g, 0, 1, 6);
  assert.equal(g.buildingMarket[0], "farm_t");
  assert.deepEqual(g.buildingDeck, ["mill", "barracks", "bridge"]);
  assert.equal(g.buildingReplacements, 1);
  // The other kingdom makes the second purchase in this shared market.
  g.active = 1;
  g.players[g.active].units[0].moves = 3;
  g.players[g.active].units[0].ended = false;
  g.players[g.active].units[0].acted = false;
  g.players[1].resources={food:4,material:4,gold:1};
  g.buildingMarket[1] = "house";
  prepareBuilding(g, "house", 11, 6, 2);
  build(g, 1, 11, 6, 2);
  assert.equal(g.buildingMarket[1], "mill");
  assert.equal(g.buildingReplacements, 2);
});

test("dès le deuxième remplacement les tiers avancés sont autorisés", () => {
  for (const replacement of ["bridge", "farm_t", "barracks", "stable"]) {
    const g = createGame();
    g.buildingReplacements = 1;
    g.players[0].resources={food:4,material:4,gold:1};
    g.buildingMarket[0] = "house";
    g.buildingDeck.unshift(replacement);
    prepareBuilding(g, "house", 1, 6);
    build(g, 0, 1, 6);
    assert.equal(g.buildingMarket[0], replacement);
  }
});

test("la première relance exclut les tiers 2 et la deuxième les autorise", () => {
  const g = createGame();
  g.players[0].resources.gold = 5;
  g.buildingDeck = ["mill", "barracks", "sawmill", "bridge", "farm_t", "quarry", "mine"];
  const cards = [...g.buildingMarket, ...g.buildingDeck].sort();
  rerollMarket(g, "building");
  assert.deepEqual(g.buildingMarket, ["sawmill", "bridge", "farm_t", "quarry", "mine"]);
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
  g.buildingDeck = ["mill", "barracks", "house", "forge", "farm_t"];
  const before = structuredClone(g);
  assert.match(rerollError(g, "building"), /tier 1 or lower/);
  assert.throws(() => rerollMarket(g, "building"));
  assert.deepEqual(g, before);
});
