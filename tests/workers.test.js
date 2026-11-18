import {test} from "node:test";
import assert from "node:assert/strict";
import {createGame,assignWorker,workerAssignmentError,harvestPreview,endTurn,recruit,recruitError,build} from "../src/engine.js";
function setup(){const g=createGame();g.board["3,3"]={terrain:"plain",building:{type:"farm",owner:0}};g.board["9,9"]={terrain:"forest",building:{type:"sawmill",owner:0}};return g;}
test("ouvrier initial libre, sans position et sans recrutement séparé",()=>{
 const g=setup();assert.deepEqual(g.players[0].workerAssignments,[{id:0,building:null}]);
 assert.match(recruitError(g),/maison/);const before=structuredClone(g);assert.throws(()=>recruit(g));assert.deepEqual(g,before);
});
test("affectation lointaine et réaffectation gratuites, même après l’action du roi",()=>{
 const g=setup(),resources={...g.players[0].resources};g.acted=true;assignWorker(g,0,3,3);assignWorker(g,0,9,9);
 assert.deepEqual(g.players[0].resources,resources);assert.equal(g.moves,2);assert.equal(g.players[0].workerAssignments[0].building,"9,9");
 assert.equal(harvestPreview(g).amounts.food,0);assert.equal(harvestPreview(g).amounts.material,1);
});
test("seule l’affectation finale produit ; libérer ne récolte rien",()=>{
 const g=setup();assignWorker(g,0,3,3);assignWorker(g,0,9,9);const before={...g.players[0].resources};
 endTurn(g);assert.equal(g.players[0].resources.food,before.food);assert.equal(g.players[0].resources.material,before.material+1);
 endTurn(g);assignWorker(g,0,null,null);assert.equal(harvestPreview(g).amounts.material,0);
});
test("un ouvrier par producteur, pas d’affectation aux bâtiments passifs ou adverses",()=>{
 const g=setup();g.players[0].workerAssignments.push({id:1,building:null});g.players[0].workers=2;
 assignWorker(g,0,3,3);assert.ok(workerAssignmentError(g,1,3,3));
 assert.ok(workerAssignmentError(g,1,0,6));assert.ok(workerAssignmentError(g,1,12,6));assert.ok(workerAssignmentError(g,1,4,4));
});
test("maison : l’ouvrier arrive après une construction et produit dès ce tour",()=>{
 const g=setup();g.board["1,6"]={terrain:"plain"};g.buildingMarket[0]="house";build(g,0,1,6);
 assignWorker(g,1,3,3);assert.equal(harvestPreview(g).amounts.food,1);assert.equal(g.acted,true);
});
