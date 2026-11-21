import { createSandboxGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { key, BUILDINGS } from "../src/engine.js";
import { buildingMarketView, selectionView } from "../src/ui/views.js";

test('tour et donjon affichent leur défense totale avec le même bouton d’information', () => {
  const g = createGame(), p = g.players[g.active];
  for (const type of ['castle', 'outpost']) {
    g.board[key(p.x, p.y)].building = { type, owner: g.active };
    const html = selectionView(g, { mode: 'inspect', selected: { x: p.x, y: p.y } });
    assert.match(html, /shield\.svg[^>]*> 2/);
    assert.ok(html.includes(BUILDINGS[type].icon));
  }
});

test("cartes du marché et inspection des bâtiments posés donnent accès aux détails", () => {
  const g = createGame();
  g.buildingMarket = ["mine_square"];
  const market = buildingMarketView(g, { buildingRotation: 0 });
  assert.match(market, /aria-haspopup="dialog"/);
  assert.match(market, /data-building-details="mine_square"/);
  const p = g.players[0];
  g.board[key(p.x, p.y)].building = {type: "mill_l", owner: 0, rotation: 2};
  const selected = selectionView(g, {selected: {x:p.x, y:p.y}});
  assert.match(selected, /data-building-details="mill_l"/);
  assert.match(selected, /data-building-orientation="2"/);
});
