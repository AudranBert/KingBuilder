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
  assert.deepEqual(buildings.sort(), Object.keys(CONFIG.buildings).sort());
  assert.deepEqual(tiles.sort(), CONFIG.tiles.map(t => t.id).sort());
  assert.match(html, /84 cartes dans la pioche/);
  assert.match(html, /Bâtiment de départ · hors pioche/);
  assert.match(html, /id="catalogue-tiles"[^>]* hidden/);
});

test("le filtre de tier garde les variantes et prévoit le tier 3 vide", () => {
  for (const tier of [0, 1, 2, 3]) {
    const html = catalogueView({ tier: String(tier) });
    const ids = [...html.matchAll(/data-catalogue-building="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(ids.sort(), Object.values(CONFIG.buildings).filter(b => b.tier === tier).map(b => b.id).sort());
    assert.match(html, new RegExp(`data-catalogue-tier="${tier}" aria-pressed="true"`));
    if (tier === 3) assert.match(html, /Aucun bâtiment dans ce tier/);
  }
});

test("les tuiles combinent taille et terrain, avec des tris déterministes", () => {
  const idsFrom = html => [...html.matchAll(/data-catalogue-tile="([^"]+)"/g)].map(m => m[1]);
  const filtered = CONFIG.tiles.filter(t => t.cells.length === 4 && t.cells.some(c => c.terrain === "river"));
  assert.ok(filtered.length);
  const actual = idsFrom(catalogueView({ tileSize: "4", terrain: "river" }));
  assert.deepEqual(actual.sort(), filtered.map(t => t.id).sort());
  const byId = Object.fromEntries(CONFIG.tiles.map(t => [t.id, t]));
  for (const [tileSort, metric] of [
    ["size", t => t.cells.length],
    ["size-desc", t => -t.cells.length],
    ["diversity", t => new Set(t.cells.map(c => c.terrain)).size],
    ["terrain", t => [...new Set(t.cells.map(c => CONFIG.terrains[c.terrain].name))].sort().join(" / ")],
  ]) {
    const values = idsFrom(catalogueView({ tileSort })).map(id => metric(byId[id]));
    for (let i = 1; i < values.length; i++) {
      assert.ok(typeof values[i] === "string" ? values[i-1].localeCompare(values[i], "fr") <= 0 : values[i-1] <= values[i], tileSort);
    }
  }
  assert.match(catalogueView({ tileSize: "99" }), /Aucune tuile ne correspond/);
});
