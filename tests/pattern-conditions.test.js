import { createFixedGame as createGame } from "./helpers.js";
import {test} from 'node:test';
import assert from 'node:assert/strict';
import { build, buildError, buildingAt, terrainAt, bridgeAt, selectUnit,
  move, produce, productionPreview, endTurn } from "../src/engine.js";
import {catalogueView} from '../src/ui/views.js';

function setup(){
  const g=createGame(()=>0.5,'solo');g.board={};g.players[0].resources={material:30,food:30,gold:30};
  Object.assign(g.players[0].units[0],{x:4,y:4});selectUnit(g,0);return g;
}

test('les terrains d’une ferme restent libres pour produire et construire',()=>{
  const g=setup();for(const x of [4,5,6])g.board[`${x},4`]={terrain:'plain'};
  const before=structuredClone(g.board['5,4']);g.buildingMarket=['farm'];build(g,0,4,4);
  assert.deepEqual(g.board['5,4'],before);assert.deepEqual(g.board['6,4'],before);
  assert.equal(buildingAt(g,5,4),null);assert.equal(terrainAt(g,5,4),'field');
  assert.deepEqual(productionPreview(g,{x:5,y:4},0),{resource:'food',amount:1});
  endTurn(g);move(g,5,4);const food=g.players[0].resources.food;produce(g);assert.equal(g.players[0].resources.food,food+1);
  Object.assign(g.players[0].units[1],{x:5,y:4});selectUnit(g,1);
  g.board['5,5']={terrain:'river'};g.buildingMarket=['house_water'];
  assert.equal(buildError(g,0,5,4,1),null);build(g,0,5,4,1);
  assert.equal(g.board['5,4'].building.type,'house_water');assert.equal(g.board['4,4'].building.type,'farm');
  assert.ok(Object.values(g.board).every(c=>!c.overlay));
});

test('deux patterns peuvent partager un terrain déjà occupé par un autre bâtiment',()=>{
  const g=setup();g.board['4,4']={terrain:'plain'};g.board['6,4']={terrain:'plain'};
  g.board['5,4']={terrain:'mountain',building:{type:'quarry_ridge',owner:0}};
  const neighbour=structuredClone(g.board['5,4']);g.buildingMarket=['small_monument'];
  assert.equal(buildError(g,0,4,4),null);build(g,0,4,4);
  Object.assign(g.players[0].units[1],{x:6,y:4});selectUnit(g,1);g.buildingMarket=['small_monument'];
  assert.equal(buildError(g,0,6,4,2),null);build(g,0,6,4,2);
  assert.deepEqual(g.board['5,4'],neighbour);
});

test('le grand pont reste franchissable et ses cases de passage restent réutilisables',()=>{
  const g=setup();Object.assign(g.players[0].units[0],{x:4,y:3});
  for(const [position,terrain] of Object.entries({'4,3':'plain','3,4':'plain','4,4':'river','5,4':'river','6,4':'plain'}))g.board[position]={terrain};
  const passage=structuredClone(g.board['5,4']);g.buildingMarket=['great_bridge'];build(g,0,4,4);
  assert.deepEqual(g.board['5,4'],passage);assert.equal(buildingAt(g,5,4),null);assert.ok(bridgeAt(g,5,4));
  endTurn(g);move(g,4,4);move(g,5,4);
  g.board['5,3']={terrain:'river'};g.board['5,5']={terrain:'river'};g.buildingMarket=['fisher'];
  assert.equal(buildError(g,0,5,4,1),null);build(g,0,5,4,1);
  assert.equal(buildingAt(g,5,4).building.type,'fisher');assert.equal(g.board['4,4'].building.type,'great_bridge');
  delete g.board['4,4'].building;assert.equal(bridgeAt(g,5,4),null);
});

test('les champs restent des conditions valides pour les moulins sans réserver le terrain',()=>{
  const g=setup();for(const x of [4,5,6])g.board[`${x},4`]={terrain:'plain'};
  g.buildingMarket=['farm'];build(g,0,4,4);
  Object.assign(g.players[0].units[1],{x:5,y:3});selectUnit(g,1);g.board['5,3']={terrain:'plain'};g.buildingMarket=['mill'];
  assert.equal(buildError(g,0,5,3,1),null);const field=structuredClone(g.board['5,4']);build(g,0,5,3,1);
  assert.deepEqual(g.board['5,4'],field);assert.equal(buildingAt(g,5,4),null);
  assert.doesNotMatch(catalogueView(),/dashed|Pointillés/);
});
