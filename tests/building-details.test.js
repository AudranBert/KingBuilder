import { createSandboxGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { key, BUILDINGS } from "../src/engine.js";
import { buildingDetailsView, buildingMarketView, selectionView, rulesView } from "../src/ui/views.js";

test("les règles résument le jeu et renvoient les motifs au catalogue", () => {
  const html = rulesView();
  assert.equal([...html.matchAll(/<h3>/g)].length, 7);
  assert.ok(html.includes("catalogue"));
  assert.ok(!html.includes("<h3>Bâtiments</h3>"));
  assert.ok(!html.includes("Motifs possibles"));
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
