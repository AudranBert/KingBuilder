import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, explore, key } from "../src/engine.js";
import { territoryBorders } from "../src/ui/board.js";
test("la frontière entoure seulement les cases portant un bâtiment, même dans les anciens états", () => {
 const g = { players: [{}, {}], board: {
  "0,0": {building:{type:"barracks",owner:0}},
  "1,0": {overlay:{anchor:"0,0",owner:0}},
  "0,1": {owner:0}, "2,0": {building:{type:"house",owner:1}},
 }};
 assert.deepEqual(territoryBorders(g,0,0),["top","right","bottom","left"]);
 assert.deepEqual(territoryBorders(g,1,0),[]);
 assert.deepEqual(territoryBorders(g,2,0),["top","right","bottom","left"]);
 assert.deepEqual(territoryBorders(g,0,1),[]);
});
test("les cases révélées sont communes et sans contour de propriété",()=>{
 const g=createGame();g.tileMarket[0]={cells:[{x:0,y:0,terrain:"plain"},{x:1,y:0,terrain:"forest"}]};
 g.players[0].units[0].x=1;explore(g,0,2,6);assert.equal(g.board[key(2,6)].owner,undefined);
 assert.deepEqual(territoryBorders(g,1,6),[]);
});
