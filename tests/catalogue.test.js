import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/configuration.js";
import { catalogueView } from "../src/ui/views.js";

test("le catalogue contient chaque famille une fois, tous les motifs et toutes les tuiles", () => {
  const html = catalogueView();
  const families = [...html.matchAll(/data-catalogue-family="([^"]+)"/g)].map(m => m[1]);
  const buildings = [...html.matchAll(/data-catalogue-building="([^"]+)"/g)].map(m => m[1]);
  const tiles = [...html.matchAll(/data-catalogue-tile="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(families.sort(), [...new Set(Object.values(CONFIG.buildings).map(b => b.family || b.id))].sort());
  assert.deepEqual(buildings.sort(), Object.values(CONFIG.buildings).filter(b => b.constructible === false || b.weight > 0).map(b => b.id).sort());
  assert.deepEqual(tiles.sort(), CONFIG.tiles.map(t => t.id).sort());
  assert.match(html, new RegExp(`${CONFIG.buildingDeckSize} cartes dans la pioche`));
  assert.match(html, /Bâtiment de départ · hors pioche/);
  assert.match(html, /id="catalogue-tiles"[^>]* hidden/);
});

test("le filtre de tier garde les variantes et affiche les tiers disponibles", () => {
  for (const tier of [0, 1, 2, 3]) {
    const html = catalogueView({ tier: String(tier) });
    const ids = [...html.matchAll(/data-catalogue-building="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(ids.sort(), Object.values(CONFIG.buildings).filter(b => b.tier === tier && (b.constructible === false || b.weight > 0)).map(b => b.id).sort());
    assert.match(html, new RegExp(`data-catalogue-tier="${tier}" aria-pressed="true"`));
    if (!Object.values(CONFIG.buildings).some(b => b.tier === tier)) assert.match(html, /Aucun bâtiment dans ce tier/);
  }
});
