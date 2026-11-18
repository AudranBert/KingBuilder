import {test} from "node:test";
import assert from "node:assert/strict";
import {createGame,selectUnit,actor,move,explore,build,trainUnit,trainError,endTurn,key} from "../src/engine.js";
function emissary(){const g=createGame();g.board["2,6"]={terrain:"plain"};g.players[0].x=2;g.players[0].resources={material:10,food:10,gold:10};g.buildingMarket[0]="chancellery";build(g,0,2,6);endTurn(g);endTurn(g);selectUnit(g,0);return g;}
test("l’émissaire explore et construit sans consommer l’activation du roi",()=>{
 const g=emissary();g.tileMarket[0]={cells:[{x:0,y:0,terrain:"plain"}]};explore(g,0,3,6);
 assert.equal(g.acted,false);assert.equal(actor(g).acted,true);assert.equal(g.moves,2);
 endTurn(g);endTurn(g);selectUnit(g,0);g.buildingMarket[0]="house";build(g,0,3,6);
 assert.equal(g.board["3,6"].building.type,"house");assert.equal(g.players[0].workers,2);assert.equal(g.acted,false);
});
test("l’émissaire respecte les obstacles, ponts et unités adverses",()=>{
 const g=emissary();g.board["3,6"]={terrain:"river"};assert.throws(()=>move(g,3,6));
 g.board["3,6"].building={type:"bridge",owner:0};move(g,3,6);
 g.players[1].x=4;g.players[1].y=6;g.board["4,6"]={terrain:"plain"};assert.throws(()=>move(g,4,6));
});
test("recrutement : quotas distincts et refus atomiques",()=>{
 const g=createGame();for(const x of [2,4])g.board[key(x,6)]={terrain:"plain",building:{type:"barracks",owner:0}};
 g.players[0].resources.food=10;trainUnit(g,2,6,"soldier");trainUnit(g,4,6,"soldier");
 const before=structuredClone(g);assert.throws(()=>trainUnit(g,2,6,"soldier"));assert.deepEqual(g,before);
 assert.ok(trainError(g,2,6,"emissary"));g.finished=true;assert.ok(trainError(g,4,6,"soldier"));
});
