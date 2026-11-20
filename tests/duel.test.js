import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame, RULES, BUILDINGS, UNIT_DEFINITIONS, key, actor, selectUnit, selectArmy,
  selectedSoldiers, armyAt, attack, attackError, combatPreview, attackPaths,
  defenseAt,
  move, exploreError, buildError, build, patternAt, trainUnit, trainError,
  endTurn, assignWorker, harvestPreview, score, totalScore, destroyBuilding,
} from "../src/engine.js";
import { costPayment, tradePrice, settleMissions, initializeMissions } from "../src/objectives.js";
import { moveUnitTo } from "../src/ui/interactions.js";
import { validateGame } from "../src/validation.js";
import { territoryBorders } from "../src/ui/board.js";
import { armyControlsView, rulesView, tradeView } from "../src/ui/views.js";
import { createUIState, hasSelectedUnit } from "../src/ui/state.js";

function game() {
  const g = createGame(() => .42);
  // A revealed arena for exercising military rules independently of tile draws.
  for (let y=1;y<6;y++) for (let x=1;x<11;x++) g.board[key(x,y)] = {terrain:"plain"};
  return g;
}
function soldiers(g,owner,n,x,y,{ended=false,moves=3}={}) {
  const p=g.players[owner], out=[];
  for(let i=0;i<n;i++) {
    const unit={id:p.nextUnitId++,type:"soldier",x,y,moves,acted:ended,ended};
    p.units.push(unit); out.push(unit);
  }
  return out;
}
function prepareBuilding(g,type,x=2,y=2) {
  g.players[0].x=x;g.players[0].y=y;
  for(const c of patternAt(type,x,y)) g.board[key(c.x,c.y)]={terrain:c.terrain[0]};
  g.players[0].resources={material:50,food:50,gold:50};
  g.buildingMarket[0]=type;
}

test("duel : trois ressources, cinq drapeaux symétriques, 25 tours et aucun score gratuit",()=>{
  const g=createGame();
  assert.deepEqual(Object.keys(g.players[0].resources).sort(),["food","gold","material"]);
  assert.equal(RULES.rounds,25);assert.equal(g.moves,3);
  const flags=Object.entries(g.board).filter(([,c])=>c.flag);
  assert.equal(flags.length,5);
  for(const [pos,c] of flags) {
    const [x,y]=pos.split(",").map(Number);
    assert.equal(c.flag.owner,null);assert.equal(c.terrain,"plain");
    assert.ok(g.board[key(RULES.size-1-x,y)].flag);
  }
  g.players[0].resources.gold=999;g.players[0].workers=999;g.players[0].revealed=999;
  assert.deepEqual(score(g,0),{buildings:0,flags:0});
});

test("maison : ouvrier immédiat sans population et affectation après construction",()=>{
  const g=game();prepareBuilding(g,"house");
  const before=g.players[0].workers;
  build(g,0,2,2);
  assert.equal(g.players[0].workers,before+1);
  assert.equal(g.players[0].resources.food,48);assert.equal(g.players[0].resources.material,48);
  g.board["8,2"]={terrain:"forest",building:{type:"sawmill",owner:0}};
  assignWorker(g,before,8,2);
  assert.equal(harvestPreview(g).amounts.material,1);
});

test("caserne : soldat offert, recrutement payant par tour et arrivée grisée",()=>{
  const g=game();prepareBuilding(g,"barracks");
  build(g,0,2,2);
  assert.equal(g.players[0].units.length,1);
  const free=g.players[0].units[0];assert.equal(free.type,"soldier");assert.equal(free.x,2);
  assert.equal(free.ended,true);assert.equal(free.moves,0);
  const food=g.players[0].resources.food;
  trainUnit(g,2,2,"soldier");
  assert.equal(g.players[0].resources.food,food-2);
  assert.match(trainError(g,2,2,"soldier"),/déjà recruté/);
  endTurn(g);endTurn(g);
  assert.ok(g.players[0].units.every(u=>u.moves===3&&!u.acted&&!u.ended));
  assert.equal(trainError(g,2,2,"soldier"),null);
});

test("chancellerie : émissaire unique, bâtisseur supplémentaire sans pouvoir militaire",()=>{
  const g=game();prepareBuilding(g,"chancellery");build(g,0,2,2);
  const u=g.players[0].units[0];assert.equal(u.type,"emissary");assert.ok(u.ended);
  endTurn(g);endTurn(g);selectUnit(g,u.id);
  assert.equal(actor(g).moves,3);
  assert.match(attackError(g,3,2),/Seule une armée/);
  g.buildingMarket[0]="chancellery";
  assert.match(buildError(g,0,3,2),/Un seul émissaire/);
  destroyBuilding(g,2,2);
  assert.match(buildError(g,0,3,2),/Un seul émissaire/);
});

for(const [a,d,as,ds] of [[7,5,1,0],[6,5,0,0],[5,5,0,1],[4,5,0,2],[1,0,1,0]]) {
  test(`combat ${a} contre ${d} : ${as} attaquant(s), ${ds} défenseur(s)`,()=>{
    const g=game(), units=soldiers(g,0,a,2,2);soldiers(g,1,d,3,2);
    if(!d) g.board["3,2"].flag={owner:null};
    selectUnit(g,units[0].id);attack(g,3,2);
    assert.equal(g.players[0].units.length,as);assert.equal(g.players[1].units.length,ds);
    if(as) assert.ok(g.players[0].units.every(u=>u.x===3&&u.acted&&u.moves===0));
  });
}

test("garnison : égalité sans destruction, occupation avec un survivant pour détruire",()=>{
  const g=game();g.board["3,2"]={terrain:"plain",flag:{owner:1},building:{type:"outpost",owner:1}};
  let units=soldiers(g,0,2,2,2);selectUnit(g,units[0].id);attack(g,3,2);
  assert.equal(g.board["3,2"].building.type,"outpost");assert.equal(g.board["3,2"].flag.owner,1);
  units=soldiers(g,0,3,2,2);selectUnit(g,units[0].id);attack(g,3,2);
  assert.equal(g.board["3,2"].building,undefined);assert.equal(g.board["3,2"].flag.owner,0);
  assert.equal(armyAt(g,0,3,2).length,1);
});

test("tour : tous les terrains révélés libres, avec ou sans drapeau",()=>{
  for (const terrain of ["plain","forest","mountain","river","field"]) {
    const g=game();prepareBuilding(g,"outpost");g.board["2,2"].terrain=terrain;
    assert.equal(buildError(g,0,2,2),null);build(g,0,2,2);
    assert.equal(g.board["2,2"].building.type,"outpost");
    assert.equal(g.board["2,2"].terrain,terrain);
    endTurn(g);endTurn(g);g.buildingMarket[0]="outpost";
    assert.match(buildError(g,0,2,2),/chevauche/);
  }
  const g=game();prepareBuilding(g,"outpost");g.board["2,2"].flag={owner:null};
  build(g,0,2,2);assert.equal(g.board["2,2"].flag.owner,0);
});

test("garnison renforcée : un seul bonus défensif et garnison retirée en dernier",()=>{
  const g=game();g.board["3,2"].building={type:"outpost",owner:1};
  soldiers(g,1,5,3,2);const units=soldiers(g,0,5,2,2);selectUnit(g,units[0].id);
  assert.equal(combatPreview(g,3,2).defense,7);attack(g,3,2);
  assert.equal(armyAt(g,1,3,2).length,1);assert.ok(g.board["3,2"].building);
});

test("donjon : une égalité conserve le donjon ; une occupation termine immédiatement",()=>{
  const g=game(), {x,y}=g.players[1].home;
  g.board[key(x-1,y)]={terrain:"plain"};
  let units=soldiers(g,0,2,x-1,y);selectUnit(g,units[0].id);attack(g,x,y);
  assert.equal(g.finished,false);assert.ok(g.board[key(x,y)].building);
  units=soldiers(g,0,3,x-1,y);selectUnit(g,units[0].id);attack(g,x,y);
  assert.equal(g.finished,true);assert.equal(g.winner,0);assert.equal(g.victory,"conquest");
  assert.equal(armyAt(g,0,x,y).length,1);assert.throws(()=>endTurn(g),/terminée/);
  validateGame(g);
});

test("drapeaux : capture persistante, recapture et score sans garnison obligatoire",()=>{
  const g=game();g.board["3,2"].flag={owner:null};
  let u=soldiers(g,0,1,2,2)[0];selectUnit(g,u.id);attack(g,3,2);
  endTurn(g);endTurn(g);selectUnit(g,u.id);move(g,4,2);
  assert.equal(g.board["3,2"].flag.owner,0);assert.equal(score(g,0).flags,RULES.points.flag);
  endTurn(g);u=soldiers(g,1,1,3,3)[0];selectUnit(g,u.id);attack(g,3,2);
  assert.equal(g.board["3,2"].flag.owner,1);
});

test("destruction : seulement la case du bâtiment, empreinte libérée et ouvriers rendus",()=>{
  const g=game();prepareBuilding(g,"farm",5,4);build(g,0,5,4);assignWorker(g,0,5,4);
  assert.ok(g.board["5,3"].overlay);
  endTurn(g);
  const u=soldiers(g,1,1,4,3)[0];selectUnit(g,u.id);
  assert.ok(attackError(g,5,3)); // Auxiliary field is not a military target.
  move(g,5,3);attack(g,5,4);
  assert.equal(g.board["5,4"].building,undefined);
  assert.equal(g.players[0].workerAssignments[0].building,null);
  for(const c of patternAt("farm",5,4)) {
    assert.equal(g.board[key(c.x,c.y)].overlay,undefined);
    assert.equal(g.board[key(c.x,c.y)].terrain,"plain");
  }
  assert.equal(g.players[0].workers,1);
});

test("une maison détruite ne supprime pas son ouvrier et une caserne ses soldats",()=>{
  const g=game();prepareBuilding(g,"house");build(g,0,2,2);
  const workers=g.players[0].workers;destroyBuilding(g,2,2);assert.equal(g.players[0].workers,workers);
  g.board["3,2"].building={type:"barracks",owner:0};soldiers(g,0,3,4,2);
  destroyBuilding(g,3,2);assert.equal(g.players[0].units.length,3);
});

test("retour des bâtisseurs : bâtiment d’origine ou donjon et prochain tour perdu",()=>{
  const g=game();g.players[1].x=3;g.players[1].y=2;
  g.players[1].units.push({id:0,type:"emissary",x:3,y:2,home:{x:9,y:2},moves:2,acted:false,ended:false});
  const u=soldiers(g,0,1,2,2)[0];selectUnit(g,u.id);attack(g,3,2);
  assert.deepEqual([g.players[1].x,g.players[1].y],[g.players[1].home.x,g.players[1].home.y]);
  assert.equal(g.players[1].units[0].x,g.players[1].home.x);
  endTurn(g);assert.equal(g.kingEnded,true);assert.equal(g.players[1].units[0].ended,true);
  endTurn(g);endTurn(g);assert.equal(g.kingEnded,false);assert.equal(g.players[1].units[0].ended,false);
});

test("un émissaire capturé revient à sa Chancellerie existante",()=>{
  const g=game();g.board["9,2"].building={type:"chancellery",owner:1};
  g.players[1].units.push({id:0,type:"emissary",x:3,y:2,home:{x:9,y:2},moves:2,acted:false,ended:false});
  selectUnit(g,soldiers(g,0,1,2,2)[0].id);attack(g,3,2);
  assert.equal(g.players[1].units[0].x,9);assert.equal(g.players[1].units[0].skipTurns,1);
});

test("piles : séparation, fusion automatique et conservation du budget de chaque pion",()=>{
  const g=game(), units=soldiers(g,0,4,2,2);selectUnit(g,units[0].id);selectArmy(g,2);
  move(g,3,2);assert.equal(armyAt(g,0,2,2).length,2);assert.equal(armyAt(g,0,3,2).length,2);
  const fresh=soldiers(g,0,1,3,2)[0];selectUnit(g,fresh.id);
  assert.equal(selectedSoldiers(g).length,3);assert.equal(actor(g).moves,2);
  move(g,4,2);assert.equal(actor(g).moves,1);
  assert.equal(g.players[0].units.find(u=>u.id===fresh.id).moves,2);
  assert.match(armyControlsView(g), /Attaque : 3/);
  assert.match(armyControlsView(g), /Défense : 4/);
  selectArmy(g,1);assert.equal(actor(g).id,fresh.id);move(g,5,2);
  assert.equal(armyAt(g,0,4,2).length,2);assert.equal(armyAt(g,0,5,2).length,1);
});

test('les puissances de la description utilisent les mêmes défenses que les combats', () => {
  const g = game();
  assert.equal(defenseAt(g, 0, 2, 2).defense, 0);
  g.board[key(2, 2)].building = { type: 'outpost', owner: 0 };
  assert.equal(defenseAt(g, 0, 2, 2).defense, 2);
  const selected = soldiers(g, 0, 2, 2, 2);
  soldiers(g, 0, 2, 2, 2, { ended: true });
  selectUnit(g, selected[0].id);
  selectArmy(g, 1);
  const html = armyControlsView(g);
  assert.match(html, /Attaque : 1/);
  assert.match(html, /Défense : 6/);
  assert.match(html, /icon-sword\.svg/);
  assert.match(html, /icon-shield\.svg/);
  assert.doesNotMatch(html, /disponible/);
  const enemy = soldiers(g, 1, 8, 3, 2);
  g.active = 1;
  selectUnit(g, enemy[0].id);
  assert.equal(combatPreview(g, 2, 2).defense, 6);
});

test('la disparition d’une armée sélectionnée ne sélectionne pas le roi à sa place', () => {
  const g = game(), selected = soldiers(g, 0, 1, 2, 2)[0], ui = createUIState();
  g.board[key(3, 2)].building = { type: 'outpost', owner: 1 };
  selectUnit(g, selected.id);
  ui.unitSelection = { id: selected.id, owner: g.active, round: g.round };
  assert.equal(hasSelectedUnit(g, ui), true);
  attack(g, 3, 2);
  assert.equal(g.players[0].units.length, 0);
  assert.equal(hasSelectedUnit(g, ui), false);
});

test("les recrues grisées ne repartent pas en fusionnant et les soldats ne bâtissent pas",()=>{
  const g=game(), fresh=soldiers(g,0,1,2,2)[0];soldiers(g,0,2,2,2,{ended:true,moves:0});
  selectUnit(g,fresh.id);assert.equal(selectedSoldiers(g).length,1);move(g,3,2);
  assert.equal(armyAt(g,0,2,2).length,2);
  assert.match(buildError(g,0,3,2),/ne peuvent pas construire/);
  assert.match(exploreError(g,0,3,3),/ne peuvent pas explorer/);
});

test("déplacement puis combat : cible à trois cases, aucune chaîne d’occupation",()=>{
  const g=game();g.board["5,2"].flag={owner:null};g.board["6,2"].flag={owner:null};
  selectUnit(g,soldiers(g,0,1,2,2)[0].id);
  assert.deepEqual(attackPaths(g).get("5,2"),[{x:3,y:2},{x:4,y:2}]);
  moveUnitTo(g,5,2);assert.equal(g.board["5,2"].flag.owner,0);
  assert.equal(attackPaths(g).size,0);assert.throws(()=>moveUnitTo(g,6,2));
});

test("commerce : prix par producteur adverse, aucune influence des affectations",()=>{
  const g=game();g.players[0].resources={material:0,food:0,gold:20};
  g.board["3,2"].building={type:"sawmill",owner:1};g.board["4,2"].building={type:"quarry",owner:1};
  assert.equal(tradePrice(g,"material"),4);assert.equal(tradePrice(g,"food"),2);
  const payment=costPayment(g,{material:2,food:1,gold:3});
  assert.equal(payment.gold,10);assert.equal(payment.totalGold,13);assert.equal(payment.affordable,true);
  assert.deepEqual(payment.resources,{material:0,food:0,gold:13});
  assert.match(tradeView(g), /2 <img[^>]+resources-gold\.svg[^>]*> → <img[^>]+resources-wheat\.svg/);
  assert.match(tradeView(g), /4 <img[^>]+resources-gold\.svg[^>]*> → <img[^>]+resources-wood\.svg/);
});

test("achat à la construction : confirmation exacte, paiement atomique et or non achetable",()=>{
  const g=game();prepareBuilding(g,"house");g.players[0].resources={material:0,food:1,gold:6};
  const before=structuredClone(g);
  assert.throws(()=>build(g,0,2,2,0,{allowGold:true,expectedGold:1}),/changé/);
  assert.deepEqual(g,before);build(g,0,2,2,0,{allowGold:true,expectedGold:6});
  assert.deepEqual(g.players[0].resources,{material:0,food:0,gold:0});
  assert.equal(costPayment(g,{gold:1}).affordable,false);
});

test("recrutement avec achat à la banque et quota indépendant de la construction",()=>{
  const g=game();prepareBuilding(g,"barracks");build(g,0,2,2);
  g.players[0].resources={material:0,food:0,gold:4};trainUnit(g,2,2,"soldier");
  assert.equal(g.players[0].resources.gold,0);assert.equal(g.players[0].units.length,2);
});

test("missions : récompense en or, conservation des seuils de contribution",()=>{
  const g=game();g.missions={tiered:1,market:["explore-6"],deck:[],claimed:[]};initializeMissions(g);
  const gold=g.players[0].resources.gold;g.players[0].revealed=6;
  assert.deepEqual(settleMissions(g),["explore-6"]);assert.equal(g.players[0].resources.gold,gold+1);
  assert.equal("prestige" in g.players[0],false);
});

test("décompte : bâtiments à points et drapeaux après 50 tours individuels",()=>{
  const g=createGame();g.board["2,2"]={terrain:"plain",building:{type:"monument",owner:0}};
  g.board["6,6"].flag.owner=0;
  assert.equal(totalScore(g,0),6+RULES.points.flag);
  for(let i=0;i<49;i++) endTurn(g);assert.equal(g.finished,false);
  endTurn(g);assert.equal(g.finished,true);assert.equal(g.round,25);
  assert.match(rulesView(),/25 tours/);
});

test("propriété visuelle : terrains communs, contour des bâtiments et drapeaux",()=>{
  const g=game();g.board["2,2"].owner=0;assert.deepEqual(territoryBorders(g,2,2),[]);
  g.board["2,2"].building={type:"barracks",owner:0};g.board["3,2"].overlay={anchor:"2,2",role:"courtyard",owner:0};
  assert.deepEqual(territoryBorders(g,2,2),["top","bottom","left"]);
  assert.deepEqual(territoryBorders(g,3,2),["top","right","bottom"]);
});

test("les piles, les couleurs et le blocage des bâtisseurs restent valides",()=>{
  const g=game();soldiers(g,0,2,2,2);g.players[1].kingSkip=1;g.board["6,6"].flag.owner=0;
  selectUnit(g,0);selectArmy(g,1);validateGame(g);
});
