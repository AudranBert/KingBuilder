import {test} from "node:test";
import assert from "node:assert/strict";
import {createGame,key,explore,move,placement,endTurn,build,RULES,score,movementPaths} from "../src/engine.js";
test("13×13, deux donjons, cinq drapeaux et marchés communs",()=>{
 const g=createGame(); assert.equal(RULES.size,13);assert.equal(g.players[1].units[0].x,12);
 assert.equal(Object.keys(g.board).length,13);assert.equal(g.tileMarket.length,4);assert.equal(g.buildingMarket.length,4);
 for(const p of g.players)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const x=p.x+dx,y=p.y+dy;if(x<0||x>=RULES.size)continue;
  if(dx&&dy){assert.equal(g.board[key(x,y)],undefined);continue;}
  assert.equal(g.board[key(x,y)].terrain,"plain");
  if(dx||dy){assert.equal(g.board[key(x,y)].building,undefined);assert.equal(g.board[key(x,y)].owner,undefined);}
 }
 assert.ok(!g.buildingDeck.includes("castle"));assert.deepEqual(score(g,0),{buildings:0,flags:0});
});
test("explorer révèle un terrain commun sans déplacer le bâtisseur",()=>{
 const g=createGame();g.tileMarket[0]={cells:[{x:0,y:0,terrain:"plain"},{x:1,y:0,terrain:"forest"}]};
 move(g,1,6);assert.equal(move(g,2,6),"explore");explore(g,0,2,6);
 assert.equal(g.players[0].units[0].x,1);assert.equal(g.players[0].revealed,2);assert.equal(g.board["2,6"].owner,undefined);
 assert.equal(g.players[g.active].units[0].acted,true);assert.throws(()=>explore(g,0,3,6));
});
test("exploration atomique : chevauchements, bord et orientation incorrecte",()=>{
 const g=createGame();g.tileMarket[0]={cells:[{x:0,y:0,terrain:"plain"},{x:1,y:0,terrain:"river"}]};
 for(const [x,y,r] of [[0,6,0],[12,12,0],[1,6,.5]]) {
 const before=structuredClone(g);assert.equal(placement(g,0,x,y,r),null);assert.throws(()=>explore(g,0,x,y,r));assert.deepEqual(g,before);}
});
test("trois déplacements par bord, obstacles et chemins les plus courts",()=>{
 const g=createGame();for(let x=1;x<5;x++)g.board[key(x,6)]={terrain:"plain"};
 g.board["0,5"]={terrain:"river"};assert.throws(()=>move(g,0,5));assert.throws(()=>move(g,2,6));
 assert.equal(movementPaths(g).get("3,6").length,3);assert.equal(movementPaths(g).has("4,6"),false);
 move(g,1,6);move(g,2,6);move(g,3,6);assert.throws(()=>move(g,4,6));
});
test("construction invalide ne débite rien et un pont permet la traversée",()=>{
 const g=createGame();g.buildingMarket[0]="house";g.board["1,6"]={terrain:"river"};
 const before=structuredClone(g);assert.throws(()=>build(g,0,1,6));assert.deepEqual(g,before);
 g.buildingMarket[0]="bridge";build(g,0,1,6);endTurn(g);endTurn(g);move(g,1,6);assert.equal(g.players[0].units[0].x,1);
});
test("un tunnel se construit sur une montagne et la rend franchissable",()=>{
 const g=createGame();g.board["1,6"]={terrain:"mountain"};g.buildingMarket[0]="tunnel";
 assert.throws(()=>move(g,1,6));
 assert.equal(g.players[0].resources.material,3);
 build(g,0,1,6);
 assert.equal(g.board["1,6"].building.type,"tunnel");
 assert.equal(g.players[0].resources.material,1);
 endTurn(g);endTurn(g);
 move(g,1,6);assert.equal(g.players[0].units[0].x,1);
});
test("finir le dernier tour ne donne aucune production automatique au tour 25",()=>{
 const g=createGame();g.round=25;g.active=1;g.board["9,5"]={terrain:"forest",building:{type:"sawmill",owner:1}};
 Object.assign(g.players[1].units[0],{x:9,y:5});const before=g.players[1].resources.material;
 endTurn(g);assert.equal(g.players[1].resources.material,before);assert.equal(g.finished,true);
});
