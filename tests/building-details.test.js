import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, key } from "../src/engine.js";
import { buildingDetailsView, buildingMarketView, selectionView } from "../src/ui/views.js";

test("les détails exposent motif, étoiles, coût et effet sans survol", () => {
  const html = buildingDetailsView("mine_square", 1);
  assert.match(html, /Mine — massif carré/);
  assert.match(html, /1 étoile/);
  assert.match(html, /2 × 2 montagnes/);
  assert.match(html, /1 fer par tour/);
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
  assert.match(market, /1 fer par tour/);
  assert.match(market, /Détails au clic/);
  const p = g.players[0];
  g.board[key(p.x, p.y)].building = {type: "mill_l", owner: 0, rotation: 2};
  const selected = selectionView(g, {selected: {x:p.x, y:p.y}});
  assert.match(selected, /2 étoiles/);
  assert.match(selected, /Double le blé/);
  assert.match(selected, /data-building-details="mill_l"/);
  assert.match(selected, /data-building-orientation="2"/);
});
