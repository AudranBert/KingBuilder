import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDINGS, createGame, patternAt, build, buildError, selectUnit,
  move, moveError, movementPaths, produce, productionAmount, productionPreview, endTurn,
} from '../src/engine.js';

test('les grandes fermes et camps reçoivent les bonus sans les cumuler', () => {
  const g = createGame(() => 0.5, 'solo');
  g.board = {
    '4,4': {terrain:'plain', building:{type:'large_farm',owner:0}},
    '6,4': {terrain:'plain', building:{type:'mill',owner:0}},
    '4,6': {terrain:'plain', building:{type:'mill',owner:0}},
    '2,2': {terrain:'forest', building:{type:'large_sawmill',owner:0}},
    '2,4': {terrain:'plain', building:{type:'wood_mill',owner:0}},
  };
  assert.equal(productionAmount(g,4,4),4);
  assert.equal(productionAmount(g,2,2),4);
});

test('un ouvrier peut construire, rejoindre et exploiter un bâtiment sur montagne ou eau sans passage', () => {
  for (const [type, terrain] of [['quarry_ridge','mountain'], ['fisher','river'], ['large_fisher','river']]) {
    for (let rotation=0; rotation<4; rotation++) {
      const g = createGame(() => 0.5, 'solo');
      g.board = {};
      g.players[0].resources = {food:20,material:20,gold:20};
      for (const c of patternAt(type,4,4,rotation)) g.board[`${c.x},${c.y}`] = {terrain:c.terrain.includes(terrain)?terrain:c.terrain[0]};
      const entryNeighbours = [[4,3],[3,4],[4,5],[5,4]];
      const [sx,sy] = entryNeighbours.find(([x,y]) => !g.board[`${x},${y}`]);
      g.board[`${sx},${sy}`] = {terrain:'plain'};
      Object.assign(g.players[0].units[0],{x:sx,y:sy});
      selectUnit(g,g.players[0].units[0].id);
      g.buildingMarket = [type];
      assert.ok(moveError(g,4,4),type);
      assert.equal(buildError(g,0,4,4,rotation),null,type);
      build(g,0,4,4,rotation);
      endTurn(g);
      assert.equal(moveError(g,4,4),null,type);
      assert.ok(movementPaths(g).has('4,4'),type);
      move(g,4,4);
      const def = BUILDINGS[type], before = g.players[0].resources[def.produces];
      produce(g);
      assert.equal(g.players[0].resources[def.produces],before+def.production,type);
    }
  }
});

test('montagne et eau sans producteur ne donnent aucune ressource, même avec un passage', () => {
  const g = createGame(() => 0.5,'solo');
  for (const cell of [{terrain:'mountain'}, {terrain:'river'}, {terrain:'mountain',building:{type:'tunnel',owner:0}}, {terrain:'river',building:{type:'bridge',owner:0}}]) {
    g.board['4,4'] = cell;
    assert.equal(productionPreview(g,{x:4,y:4},0),null);
  }
});
