import { test } from "node:test";
import assert from "node:assert/strict";
import { createSandboxGame, prepareBuilding } from "./helpers.js";
import { BUILDINGS, build, buildError, key, endTurn, score, patternAt } from "../src/engine.js";
import { rotatePoint } from "../src/geometry.js";
import { dragPreview, placementGuidance, placementOrigin } from "../src/ui/interactions.js";
import { applyCommand } from "../src/commands.js";

function setup(type) {
  const game = createSandboxGame(() => .5, "solo");
  game.board = {};
  game.players[0].resources = { material: 30, food: 30, gold: 30 };
  game.buildingMarket = [type];
  prepareBuilding(game, type, 6, 6);
  return game;
}

test("construction : chaque bâtiment respecte la portée orthogonale, sans mutation en cas de refus", () => {
  for (const definition of Object.values(BUILDINGS).filter(b => b.constructible !== false)) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [2, 0], [-2, -2], [5, 5]]) {
      const game = setup(definition.id);
      Object.assign(game.players[0].units[0], { x: 6 + dx, y: 6 + dy });
      const allowed = patternAt(definition.id,6,6).some(cell => Math.abs(cell.x-6-dx)+Math.abs(cell.y-6-dy)<=1);
      if (allowed) {
        assert.equal(buildError(game, 0, 6, 6), null, `${definition.id}: ${dx},${dy}`);
        build(game, 0, 6, 6);
        assert.equal(game.players[0].units[0].acted, true);
      } else {
        const before = structuredClone(game);
        assert.match(buildError(game, 0, 6, 6), /within 1 space/, definition.id);
        assert.throws(() => build(game, 0, 6, 6));
        assert.deepEqual(game, before);
      }
    }
  }
});

test("construire depuis l'extrémité de la tuile : aperçu, guides et commande dans les huit orientations", () => {
  for(let rotation=0;rotation<8;rotation++) {
    const game=setup('farm');game.board={};prepareBuilding(game,'farm',6,6,rotation);
    const far=rotatePoint(3,0,rotation);
    Object.assign(game.players[0].units[0],{x:6+far.x,y:6+far.y});
    const choice={kind:'building',index:0,rotation};
    // The farm icon is three spaces away; the last field is adjacent.
    assert.equal(buildError(game,0,6,6,rotation),null);
    const pointer=rotatePoint(1,0,rotation),pos={x:6+pointer.x,y:6+pointer.y};
    assert.deepEqual(placementOrigin(game,choice,pos),{x:6,y:6});
    assert.equal(dragPreview(game,choice,pos).error,null);
    assert.equal(placementGuidance(game,choice).get(key(pos.x,pos.y)).error,null);
    const built=applyCommand(game,{type:'build',unit:game.players[0].units[0].id,args:[0,6,6,rotation]});
    assert.equal(built.board['6,6'].building.type,'farm');
    const diagonal=rotatePoint(3,1,rotation);
    Object.assign(game.players[0].units[0],{x:6+diagonal.x,y:6+diagonal.y});
    assert.ok(buildError(game,0,6,6,rotation));
  }
});

test("construction : terrain absent, incompatible, case bâtiment occupée et paiement impossible sont atomiques", () => {
  for (const invalidate of [
    game => delete game.board[key(7, 6)],
    game => { game.board[key(7, 6)].terrain = "river"; },
    game => { game.board[key(6, 6)].building = { type: "house", owner: 0 }; },
    game => { game.players[0].resources = { material: 0, food: 0, gold: 0 }; },
  ]) {
    const game = setup("farm");
    Object.assign(game.players[0].units[0], { x: 6, y: 6 });
    invalidate(game);
    const before = structuredClone(game);
    assert.ok(buildError(game, 0, 6, 6));
    assert.throws(() => build(game, 0, 6, 6));
    assert.deepEqual(game, before);
  }
});

test("défricher transforme la forêt, donne deux matériaux et remplace la carte sans points", () => {
  const game = setup("clearing");
  Object.assign(game.players[0].units[0], { x: 6, y: 6 });
  const before = structuredClone(game.players[0].resources);
  const next = game.buildingDeck.find(id => BUILDINGS[id].tier <= 1);
  build(game, 0, 6, 6);
  assert.deepEqual(game.board[key(6, 6)], { terrain: "plain" });
  assert.equal(game.players[0].resources.material, before.material + 2);
  assert.equal(game.players[0].resources.food, before.food);
  assert.equal(game.players[0].units[0].acted, true);
  assert.equal(game.buildingMarket[0], next);
  assert.equal(score(game, 0).buildings, 0);
  endTurn(game);
  game.buildingMarket = ["house"];
  game.board[key(7, 6)] = { terrain: "plain", building: { type: "house", owner: 0 } };
  build(game, 0, 6, 6);
  assert.equal(game.board[key(6, 6)].building.type, "house");
});
