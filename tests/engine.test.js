import {test} from "node:test";
import assert from "node:assert/strict";
import {createGame,key,explore,move,placement,endTurn,build,RULES,score,movementPaths} from "../src/engine.js";
test("13×13, deux donjons, cinq drapeaux et marchés communs",()=>{
 const g=createGame(); assert.equal(RULES.size,13);assert.equal(g.players[1].x,12);
 assert.equal(Object.keys(g.board).length,7);assert.equal(g.tileMarket.length,3);assert.equal(g.buildingMarket.length,3);
 assert.ok(!g.buildingDeck.includes("castle"));assert.deepEqual(score(g,0),{buildings:0,flags:0});
});
test("explorer révèle un terrain commun sans déplacer le bâtisseur",()=>{
 const g=createGame();g.tileMarket[0]={cells:[{x:0,y:0,terrain:"plain"},{x:1,y:0,terrain:"forest"}]};
 assert.equal(move(g,1,6),"explore");explore(g,0,1,6);
 assert.equal(g.players[0].x,0);assert.equal(g.players[0].revealed,2);assert.equal(g.board["1,6"].owner,undefined);
 assert.equal(g.acted,true);assert.throws(()=>explore(g,0,3,6));
});
test("exploration atomique : chevauchements, bord et orientation incorrecte",()=>{
 const g=createGame();g.tileMarket[0]={cells:[{x:0,y:0,terrain:"plain"},{x:1,y:0,terrain:"river"}]};
 for(const [x,y,r] of [[0,6,0],[12,12,0],[1,6,.5]]) {
 const before=structuredClone(g);assert.equal(placement(g,0,x,y,r),null);assert.throws(()=>explore(g,0,x,y,r));assert.deepEqual(g,before);}
});
test("deux déplacements par bord, obstacles et chemins les plus courts",()=>{
 const g=createGame();for(let x=1;x<4;x++)g.board[key(x,6)]={terrain:"plain"};
 g.board["0,5"]={terrain:"river"};assert.throws(()=>move(g,0,5));assert.throws(()=>move(g,2,6));
 assert.equal(movementPaths(g).get("2,6").length,2);assert.equal(movementPaths(g).has("3,6"),false);
 move(g,1,6);move(g,2,6);assert.throws(()=>move(g,3,6));
});
test("construction invalide ne débite rien et un pont permet la traversée",()=>{
 const g=createGame();g.buildingMarket[0]="house";g.board["1,6"]={terrain:"river"};
 const before=structuredClone(g);assert.throws(()=>build(g,0,1,6));assert.deepEqual(g,before);
 g.buildingMarket[0]="bridge";build(g,0,1,6);endTurn(g);endTurn(g);move(g,1,6);assert.equal(g.players[0].x,1);
});
test("le dernier joueur reçoit sa récolte avant le décompte au tour 25",()=>{
 const g=createGame();g.round=25;g.active=1;g.board["9,5"]={terrain:"forest",building:{type:"sawmill",owner:1}};
 g.players[1].workerAssignments[0].building="9,5";const before=g.players[1].resources.material;
 endTurn(g);assert.equal(g.players[1].resources.material,before+1);assert.equal(g.finished,true);
});
