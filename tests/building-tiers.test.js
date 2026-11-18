import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, BUILDINGS, build, key } from "../dist/engine.js";
import { buildingMarketView } from "../dist/ui/views.js";

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
  assert.match(html, /aria-label="0 étoile">0 ★/);
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

test("après construction le remplacement accepte chacun des trois tiers", () => {
  for (const replacement of ["bridge", "farm_t", "barracks"]) {
    const g = createGame();
    g.buildingMarket[0] = "house";
    g.buildingDeck.unshift(replacement);
    g.board[key(1, 6)] = { terrain: "plain" };
    build(g, 0, 1, 6);
    assert.equal(g.buildingMarket[0], replacement);
  }
});
