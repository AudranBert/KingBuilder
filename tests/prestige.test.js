import {test} from "node:test";
import assert from "node:assert/strict";
import {createGame,rerollMarket,rerollError,endTurn,build,buildingPayment,key} from "../src/engine.js";
import {initializeMissions,settleMissions,missionTarget} from "../src/objectives.js";
test("l’or remplace le prestige initial et les relances sans consommer d’action",()=>{
 const g=createGame(),p=g.players[0];assert.equal(g.players[1].resources.gold,p.resources.gold+1);assert.equal(p.prestige,undefined);
 const before=p.resources.gold,cards=[...g.tileDeck,...g.tileMarket].map(t=>t.id).sort();rerollMarket(g,"terrain");
 assert.equal(p.resources.gold,before-1);assert.equal(g.acted,false);assert.equal(g.moves,3);
 assert.deepEqual([...g.tileDeck,...g.tileMarket].map(t=>t.id).sort(),cards);assert.ok(rerollError(g,"terrain"));
});
test("relance : pas d’or, pioche insuffisante et fin de partie sans mutation",()=>{
 for(const change of [g=>g.players[0].resources.gold=0,g=>g.tileDeck=[],g=>g.finished=true]){
 const g=createGame();change(g);const before=structuredClone(g);assert.throws(()=>rerollMarket(g,"terrain"));assert.deepEqual(g,before);}
});
test("missions : premier arrivé, récompense en or et montée de niveau",()=>{
 const g=createGame();g.missions={market:["explore-6"],deck:["explore-12","explore-20"],claimed:[],tiered:1};initializeMissions(g);
 const before=g.players[0].resources.gold;g.players[0].revealed=6;assert.deepEqual(settleMissions(g),["explore-6"]);
 assert.equal(g.players[0].resources.gold,before+1);assert.deepEqual(g.missions.market,["explore-12"]);
 assert.deepEqual(settleMissions(g),[]);g.players[0].revealed=12;settleMissions(g);assert.deepEqual(g.missions.market,["explore-20"]);
});
test("nouvelle mission déjà remplie : une contribution supplémentaire est nécessaire",()=>{
 const g=createGame();g.players[0].revealed=30;g.missions={market:["explore-6"],deck:["explore-12"],claimed:[],tiered:1};initializeMissions(g);
 assert.equal(missionTarget(g,"explore-6"),31);assert.deepEqual(settleMissions(g),[]);
 g.players[0].revealed++;settleMissions(g);assert.equal(missionTarget(g,"explore-12"),32);assert.equal(g.missions.claimed.length,1);
});
test("paiement : les ressources disponibles sont utilisées avant l’achat et prix actualisé",()=>{
 const g=createGame();g.missions.market=[];g.board["1,6"]={terrain:"plain"};g.buildingMarket[0]="house";g.players[0].resources={food:1,material:0,gold:10};
 const payment=buildingPayment(g,0);assert.equal(payment.gold,6);
 g.board["9,9"]={terrain:"forest",building:{type:"sawmill",owner:1}};
 const before=structuredClone(g);assert.throws(()=>build(g,0,1,6,0,{allowGold:true,expectedGold:6}));assert.deepEqual(g,before);
 build(g,0,1,6,0,{allowGold:true,expectedGold:8});assert.equal(g.players[0].resources.gold,2);
});
