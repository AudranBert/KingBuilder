import {test} from "node:test";
import assert from "node:assert/strict";
import {createGame,selectUnit,actor,move,explore,build,trainUnit,trainError,endTurn,key} from "../src/engine.js";
function emissary(){const g=createGame();const u=g.players[0].units[1];Object.assign(u,{x:2,y:6});g.board["5,5"]={terrain:"plain"};g.board["6,5"]={terrain:"plain"};selectUnit(g,u.id);return g;}

test("le second ouvrier explore et construit sans consommer l’activation du premier ouvrier",()=>{
 const g=emissary();g.tileMarket[0]={cells:[{x:0,y:0,terrain:"plain"}]};explore(g,0,3,6);
 assert.equal(g.players[g.active].units[0].acted,false);assert.equal(actor(g).acted,true);assert.equal(g.players[g.active].units[0].moves,3);
 endTurn(g);endTurn(g);selectUnit(g,1);g.players[0].resources.food=3;g.buildingMarket[0]="house";build(g,0,3,6);
 assert.equal(g.board["3,6"].building.type,"house");assert.equal(g.players[0].workers,3);assert.equal(g.players[g.active].units[0].acted,false);
});
test("le second ouvrier respecte les obstacles, ponts et unités adverses",()=>{
 const g=emissary();g.board["3,6"]={terrain:"river"};assert.throws(()=>move(g,3,6));
 g.board["3,6"].building={type:"bridge",owner:0};move(g,3,6);
 g.players[1].units[0].x=4;g.players[1].units[0].y=6;g.board["4,6"]={terrain:"plain"};assert.throws(()=>move(g,4,6));
});
test("recrutement : quotas distincts et refus atomiques",()=>{
 const g=createGame();for(const x of [2,4])g.board[key(x,6)]={terrain:"plain",building:{type:"barracks",owner:0}};
 g.players[0].resources.food=10;trainUnit(g,2,6,"soldier");trainUnit(g,4,6,"soldier");
 const before=structuredClone(g);assert.throws(()=>trainUnit(g,2,6,"soldier"));assert.deepEqual(g,before);
 assert.ok(trainError(g,2,6,"worker"));g.finished=true;assert.ok(trainError(g,4,6,"soldier"));
});
