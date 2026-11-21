import {test} from "node:test";
import assert from "node:assert/strict";
import {createGame, actor, selectUnit, move, explore, build, endTurn, produce, produceError, productionAmount, productionPreview, UNIT_DEFINITIONS, BUILDINGS, assignWorker, migrateGame, attack} from "../src/engine.js";
import {applyCommand} from "../src/commands.js";
import {validateGame} from "../src/validation.js";
const setup = () => createGame(() => .42, "solo", {openingTilesPerPlayer:0,missionsEnabled:false});

test("deux ouvriers mobiles au donjon, sans roi, émissaire ou Chancellerie",()=>{
 const g=setup(),p=g.players[0];assert.equal(p.workers,2);assert.equal(p.units.length,2);
 for(const u of p.units){assert.equal(u.type,"worker");assert.equal(u.moves,3);assert.equal(u.acted,false);assert.deepEqual([u.x,u.y],[p.home.x,p.home.y]);}
 assert.deepEqual(Object.keys(UNIT_DEFINITIONS).sort(),["soldier","worker"]);assert.equal(BUILDINGS.chancellery,undefined);
 assert.ok(!g.buildingDeck.includes("chancellery"));validateGame(g);
});
test("production libre immédiate puis déplacement, une action par ouvrier",()=>{
 const g=setup(),p=g.players[0],before={...p.resources};move(g,1,5);produce(g);
 assert.equal(p.resources.food,before.food+1);assert.equal(actor(g).moves,2);assert.equal(actor(g).acted,true);
 assert.throws(()=>produce(g),/action/);g.board["2,5"]={terrain:"forest"};move(g,2,5);assert.equal(actor(g).moves,1);
 selectUnit(g,1);move(g,1,5);move(g,2,5);produce(g);assert.equal(p.resources.material,before.material+1);
 assert.equal(actor(g).moves,1);validateGame(g);
});
test("explorer garde les déplacements mais interdit de produire ou construire ensuite",()=>{
 const g=setup();move(g,1,5);g.tileMarket[0]={cells:[{x:0,y:0,terrain:"plain"}]};explore(g,0,2,5);
 assert.equal(actor(g).moves,2);move(g,2,5);assert.equal(actor(g).moves,1);assert.throws(()=>produce(g),/action/);
 g.buildingMarket[0]="house";assert.throws(()=>build(g,0,2,5),/action/);
});
test("bâtiment : deux ressources, une production partagée par tour et aucun gain automatique",()=>{
 const g=setup(),p=g.players[0];g.board["1,5"]={terrain:"plain",building:{type:"farm",owner:0}};
 move(g,1,5);const before=p.resources.food;produce(g);assert.equal(p.resources.food,before+2);
 selectUnit(g,1);move(g,1,5);const snapshot=structuredClone(g);assert.match(produceError(g),/déjà produit/);assert.throws(()=>produce(g));assert.deepEqual(g,snapshot);
 endTurn(g);assert.equal(p.resources.food,before+2);assert.equal(produceError(g),null);produce(g);assert.equal(p.resources.food,before+4);
});
test("maison : coût 3 et 3, recrue sur place active seulement au tour suivant",()=>{
 const g=setup(),p=g.players[0];p.resources={food:3,material:3,gold:0};g.buildingMarket[0]="house";
 build(g,0,1,5);const recruit=p.units[2];assert.deepEqual(p.resources,{food:0,material:0,gold:0});
 assert.equal(p.workers,3);assert.deepEqual([recruit.x,recruit.y],[1,5]);assert.ok(recruit.ended);assert.equal(actor(g).moves,3);
 selectUnit(g,recruit.id);assert.throws(()=>produce(g));assert.throws(()=>move(g,0,5));endTurn(g);
 assert.equal(recruit.ended,false);assert.equal(recruit.moves,3);validateGame(g);
});
test("construction puis déplacement autorisé ; produire reste une action distincte",()=>{
 const g=setup();g.board["1,5"]={terrain:"forest"};g.buildingMarket[0]="clearing";
 build(g,0,1,5);assert.equal(actor(g).moves,3);move(g,1,5);assert.equal(actor(g).moves,2);assert.throws(()=>produce(g));
});
test("un bâtiment passif, une annexe, un drapeau ou un bâtiment adverse ne produit pas",()=>{
 for(const cell of [{terrain:"plain",building:{type:"house",owner:0}},{terrain:"forest",building:{type:"sawmill",owner:1}},{terrain:"plain",flag:{owner:0}},{terrain:"plain",overlay:{anchor:"0,5",role:"courtyard",owner:0}},{terrain:"mountain"}]){
 const g=setup();g.board["1,5"]=cell;Object.assign(g.players[0].units[0],{x:1,y:5});const before=structuredClone(g);assert.throws(()=>produce(g));assert.deepEqual(g,before);}
});
test("moulin : bonus de un non cumulable et propriétaire respecté",()=>{
 const g=setup();g.board["3,3"]={terrain:"plain",building:{type:"farm",owner:0}};
 g.board["4,3"]={terrain:"field",overlay:{anchor:"3,3",role:"field",owner:0}};
 for(const pos of ["4,4","4,2"])g.board[pos]={terrain:"plain",building:{type:"mill",owner:0}};
 assert.equal(productionAmount(g,3,3),3);g.board["3,3"].building.owner=1;assert.equal(productionAmount(g,3,3),2);
});
test("tous les producteurs sont accessibles, y compris bateau et carrière sur montagne",()=>{
 assert.ok(Object.values(BUILDINGS).filter(b=>b.produces).every(b=>b.production>=2&&b.traversable));
 const g=setup();g.board["1,5"]={terrain:"river",building:{type:"fisher",owner:0}};move(g,1,5);assert.equal(productionPreview(g).amount,2);produce(g);
});
test("commande produire autoritaire, refus atomique et anciennes affectations bloquées",()=>{
 const g=setup();move(g,1,5);const next=applyCommand(g,{type:"produce",unit:0,args:[]});assert.equal(next.players[0].resources.food,g.players[0].resources.food+1);
 const snapshot=structuredClone(next);assert.throws(()=>applyCommand(next,{type:"produce",unit:0,args:[]}));assert.deepEqual(next,snapshot);
 assert.throws(()=>assignWorker(g,0,9,9));assert.throws(()=>applyCommand(g,{type:"assignWorker",unit:0,args:[0,9,9]}));validateGame(next);
});
test("les parties des anciennes règles sont refusées explicitement",()=>{
 const g=setup();g.version=5;assert.throws(()=>migrateGame(g),/anciennes règles/);
});
