import { test } from "node:test";
import assert from "node:assert/strict";
import { createFixedGame as createGame } from "./helpers.js";
import { BUILDINGS } from "../src/engine.js";
import { CONFIG } from "../src/configuration.js";

test("the 61-card deck keeps every family with the agreed quantities and six towers", () => {
  const expected = {
    house: 4, farm: 3, sawmill: 3, quarry: 3, mine: 3, fisher: 3,
    outpost: 6, barracks: 4, clearing: 4, bridge: 3, tunnel: 2,
    port: 2, mill: 1, wood_mill: 1, small_monument: 2, monument: 2,
    market: 1, toll: 1, stable: 1, forge: 1, barrack_block: 1,
    dry_dock: 1, large_monument: 1, church: 1, explorer_guild: 1,
    builder_guild: 1, great_bridge: 1, large_farm: 1, large_sawmill: 1,
    large_quarry: 1, large_fisher: 1,
  };
  assert.equal(CONFIG.buildingDeckSize, 61);
  for (const rng of [() => 0, () => .5, () => .99999]) {
    const g = createGame(rng);
    const cards = [...g.buildingMarket, ...g.buildingDeck];
    assert.equal(cards.length, 61);
    const actual = {};
    for (const id of cards) {
      const b = BUILDINGS[id], family = b.family || id;
      actual[family] = (actual[family] || 0) + 1;
      assert.ok(b.weight > 0, id);
    }
    assert.deepEqual(actual, expected);
    for (const family of ["farm", "sawmill", "quarry", "mine", "fisher"])
      assert.equal(new Set(cards.filter(id => (BUILDINGS[id].family || id) === family)).size, 3);
    assert.equal(cards.filter(id => id === "barracks").length, 2);
    assert.equal(cards.filter(id => id === "barracks_forest").length, 2);
  }
});
