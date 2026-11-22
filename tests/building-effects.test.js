import { buildError, buyTerrainError } from "./helpers.js";
import { createFixedGame as createGame } from "./helpers.js";
import {test} from 'node:test';
import assert from 'node:assert/strict';
import { productionAmount, score, trainingCapacity, build, endTurn, moveError, BUILDINGS } from "../src/engine.js";
import {buildingPayment, tradePrice} from '../src/economy.js';
function setup(){const g=createGame(()=>0.5,'solo');g.board={};g.players[0].resources={food:20,material:20,gold:20};g.players[0].units.forEach(u=>Object.assign(u,{x:4,y:4,acted:false,ended:false}));return g;}
function put(g,x,y,type){g.board[`${x},${y}`]={terrain:'plain',building:{type,owner:0}};}
test('bonus sans ouvrier : portée de 12 cases et absence de cumul',()=>{
 const g=setup();put(g,4,4,'farm');put(g,6,4,'mill');put(g,4,6,'mill');assert.equal(productionAmount(g,4,4),3);
 delete g.board['6,4'];delete g.board['4,6'];put(g,6,5,'mill');assert.equal(productionAmount(g,4,4),2);
 put(g,5,5,'mill');assert.equal(productionAmount(g,4,4),3);
 put(g,2,2,'sawmill');put(g,2,4,'wood_mill');assert.equal(productionAmount(g,2,2),3);
});
test('monuments doublés une seule fois et caserne renforcée sans ouvrier',()=>{
 const g=setup();put(g,4,4,'small_monument');put(g,6,4,'church');put(g,4,6,'church');assert.equal(score(g,0).buildings,4);
 put(g,2,2,'barracks');put(g,2,4,'barrack_block');assert.equal(trainingCapacity(g,2,2),2);
});
test('port et péage comptent les productions à portée',()=>{
 const g=setup();put(g,4,4,'port');put(g,6,4,'market');assert.equal(productionAmount(g,4,4),2);
 put(g,4,5,'toll');put(g,4,6,'mine');put(g,3,5,'farm');assert.equal(productionAmount(g,4,5),2);
});
test('ports : un or de base et un par marché ou pêcheur allié à portée de deux',()=>{
 for(const type of ['port','port_square','port_l']){
  const g=setup();put(g,4,4,type);assert.equal(productionAmount(g,4,4),1);
  put(g,6,4,'market');assert.equal(productionAmount(g,4,4),2);
  put(g,4,5,'fisher');assert.equal(productionAmount(g,4,4),3);
  put(g,3,3,'fisher_bank');assert.equal(productionAmount(g,4,4),4);
  put(g,4,7,'fisher');assert.equal(productionAmount(g,4,4),4);
  put(g,5,4,'market');g.board['5,4'].building.owner=1;assert.equal(productionAmount(g,4,4),4);
  delete g.board['6,4'];delete g.board['4,5'];delete g.board['3,3'];
  g.board['4,5']={terrain:'river'};g.board['4,6']={terrain:'river'};put(g,4,7,'port_square');
  assert.equal(productionAmount(g,4,4),1);
 }
});
test('guilde et marché réduisent effectivement les paiements',()=>{
 const g=setup();g.buildingMarket=['house'];const before=buildingPayment(g,0).resources.material;put(g,2,2,'builder_guild');assert.equal(buildingPayment(g,0).resources.material,before-1);
 const price=tradePrice(g,'food');put(g,3,2,'market');assert.equal(tradePrice(g,'food'),Math.max(1,price-1));
 put(g,2,3,'explorer_guild');assert.equal(buyTerrainError(g,'plain',8,8),null);
});
test('cale sèche et écurie activent les déplacements sans ouvrier',()=>{
 const g=setup();g.selectedUnitId=g.players[0].units[0].id;g.board['5,4']={terrain:'river'};assert.ok(moveError(g,5,4));put(g,1,1,'dry_dock');assert.equal(moveError(g,5,4),null);
 put(g,1,2,'stable');endTurn(g);assert.equal(g.players[0].units[0].moves,4);
});
test('grand pont et péage imposent leur géographie',()=>{
 const g=setup();g.selectedUnitId=g.players[0].units[0].id;g.buildingMarket=['great_bridge'];g.board['4,4']={terrain:'river'};g.board['5,4']={terrain:'river'};assert.ok(buildError(g,0,4,4));g.board['3,4']={terrain:'plain'};g.board['6,4']={terrain:'plain'};assert.equal(buildError(g,0,4,4),null);
 g.board['4,5']={terrain:'plain'};
 g.board['4,6']={terrain:'plain'};
 g.buildingMarket=['toll'];assert.ok(buildError(g,0,4,4));g.board['4,4'].building={type:'bridge',owner:0};g.board['4,6']={terrain:'plain',building:{type:'house',owner:0}};assert.equal(buildError(g,0,4,4),null);build(g,0,4,4);assert.equal(g.board['4,4'].building.type,'toll');
 assert.equal(BUILDINGS.large_monument.points,7);
});
