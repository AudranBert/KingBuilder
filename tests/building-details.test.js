import { createSandboxGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { key, BUILDINGS } from "../src/engine.js";
import { buildingDetailsView, buildingMarketView, selectionView, rulesView } from "../src/ui/views.js";

test("les règles regroupent les bâtiments par famille en conservant tous les motifs", () => {
  const catalogue = rulesView().split("<h3>Bâtiments</h3>")[1];
  const headings = [...catalogue.matchAll(/<strong>(.*?)<\/strong>/g)].map(match => match[1]);
  assert.equal(headings.length, 16);
  for (const name of ["Ferme", "Scierie", "Carrière", "Mine", "Port", "Moulin", "Tour"])
    assert.equal(headings.filter(heading => heading === name).length, 1, name);
  assert.equal(headings.filter(heading => heading.includes("Cabane de pêcheur")).length, 1);
  assert.equal(headings.filter(heading => heading.includes("Bateau de pêche")).length, 1);
  for (const b of Object.values(BUILDINGS)) assert.ok(catalogue.includes(b.pattern), b.id);
});

test("les détails exposent motif, étoiles, coût et effet sans survol", () => {
  const html = buildingDetailsView("mine_square", 1);
  assert.match(html, /id="building-details-title">Mine<\/h2>/);
  assert.match(html, /1 étoile/);
  assert.match(html, /2 × 2 montagnes/);
  assert.match(html, /1 or \/ tour/);
  assert.match(html, /Coût/);
  assert.match(html, /Montagne/);
  assert.match(buildingDetailsView("castle"), /Bâtiment de départ uniquement/);
  assert.match(buildingDetailsView("clearing"), /Gratuit/);
});

test("cartes du marché et inspection des bâtiments posés donnent accès aux détails", () => {
  const g = createGame();
  g.buildingMarket = ["mine_square"];
  const market = buildingMarketView(g, { buildingRotation: 0 });
  assert.match(market, /aria-haspopup="dialog"/);
  assert.match(market, /1 or \/ tour/);
  assert.match(market, /title="Cliquer pour les placements/);
  assert.match(market, /data-building-details="mine_square"/);
  const p = g.players[0];
  g.board[key(p.x, p.y)].building = {type: "mill_l", owner: 0, rotation: 2};
  const selected = selectionView(g, {selected: {x:p.x, y:p.y}});
  assert.match(selected, /Moulin/);
  assert.match(selected, /Nourriture des fermes voisines/);
  assert.match(selected, /data-building-details="mill_l"/);
  assert.match(selected, /data-building-orientation="2"/);
});
