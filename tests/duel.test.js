import { prepareBuilding as revealPattern } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, RULES, BUILDINGS, UNIT_DEFINITIONS, key, actor, selectUnit, selectArmy, selectedSoldiers, armyAt, attack, attackError, combatPreview, attackPaths, defenseAt, move, exploreError, buildError, build, patternAt, trainUnit, trainError, endTurn, score, totalScore, destroyBuilding } from "../src/engine.js";
import { costPayment, tradePrice } from "../src/objectives.js";
import { missionProgress, initializeMissions } from "../src/objectives.js";
import { moveUnitTo } from "../src/ui/interactions.js";
import { validateGame } from "../src/validation.js";
import { applyCommand } from "../src/commands.js";
import { armyControlsView, rulesView, tradeView, playersView } from "../src/ui/views.js";
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
  g.players[0].units[0].x=x;g.players[0].units[0].y=y;
  revealPattern(g,type,x,y);
  g.players[0].resources={material:50,food:50,gold:50};
  g.buildingMarket[0]=type;
}

test("conquête : victimes en attaque et en défense, bâtiment et drapeau sans compter la garnison", () => {
  const g = game();
  g.missions = { tiered: 1, market: ["conquests-2"], deck: [], claimed: [] };
  initializeMissions(g);
  g.board["3,2"].building = { type: "outpost", owner: 1 };
  g.board["3,2"].flag = { owner: 1 };
  soldiers(g, 1, 1, 3, 2);
  Object.assign(g.players[1].units[0], { x: 3, y: 2 });
  selectUnit(g, soldiers(g, 0, 4, 2, 2)[0].id);
  attack(g, 3, 2);
  assert.equal(missionProgress(g, "conquests-8", 0), 4);
  assert.equal(missionProgress(g, "conquests-8", 1), 3);
  assert.equal(g.missions.claimed[0].id, "conquests-2");
  validateGame(structuredClone(g));
});

test("conquête : une défense peut gagner la mission sans occupation de la cible", () => {
  const g = game();
  g.missions = { tiered: 1, market: ["conquests-2"], deck: [], claimed: [] };
  initializeMissions(g);
  soldiers(g, 1, 3, 3, 2);
  selectUnit(g, soldiers(g, 0, 2, 2, 2)[0].id);
  attack(g, 3, 2);
  assert.equal(g.missions.claimed[0].owner, 1);
  assert.equal(missionProgress(g, "conquests-8", 1), 2);
  assert.equal(missionProgress(g, "conquests-8", 0), 1);
});

test("conquête : captures par ouvrier et recaptures sans récompense répétée", () => {
  const g = game(), worker = g.players[0].units[0];
  g.missions = { tiered: 1, market: ["conquests-8"], deck: [], claimed: [] };
  initializeMissions(g);
  Object.assign(worker, { x: 2, y: 2 }); selectUnit(g, worker.id);
  g.board["3,2"] = { terrain: "plain", flag: { owner: null }, building: { type: "farm", owner: 1 } };
  move(g, 3, 2);
  assert.equal(missionProgress(g, "conquests-8"), 2);
  move(g, 2, 2);
  g.board["3,2"].building.owner = 1; g.board["3,2"].flag.owner = 1;
  move(g, 3, 2);
  assert.equal(missionProgress(g, "conquests-8"), 2);
  const invalid = structuredClone(g);
  invalid.players[0].progress.conquests.push(invalid.players[0].progress.conquests[0]);
  assert.throws(() => validateGame(invalid), /progression/);
});

test("caserne : recrutement payant par tour et arrivée grisée, sans soldat offert",()=>{
  const g=game();prepareBuilding(g,"barracks");
  build(g,0,2,2);
  assert.equal(g.players[0].units.filter(u=>u.type==="soldier").length,0);
  const food=g.players[0].resources.food;
  trainUnit(g,2,2,"soldier");
  const free=g.players[0].units.find(u=>u.type==="soldier");assert.equal(free.type,"soldier");assert.equal(free.x,2);
  assert.equal(free.ended,true);assert.equal(free.moves,0);
  assert.equal(g.players[0].resources.food,food-UNIT_DEFINITIONS.soldier.cost.food);
  assert.match(trainError(g,2,2,"soldier"),/already recruited/);
  endTurn(g);endTurn(g);
  assert.ok(g.players[0].units.every(u=>u.moves===3&&!u.acted&&!u.ended));
  assert.equal(trainError(g,2,2,"soldier"),null);
});

for(const [a,d,as,ds] of [[7,5,1,0],[6,5,0,0],[5,5,0,1],[4,5,0,2],[1,0,1,0]]) {
  test(`combat ${a} contre ${d} : ${as} attaquant(s), ${ds} défenseur(s)`,()=>{
    const g=game(), units=soldiers(g,0,a,2,2);soldiers(g,1,d,3,2);
    if(!d) g.board["3,2"].flag={owner:null};
    selectUnit(g,units[0].id);attack(g,3,2);
    assert.equal(g.players[0].units.filter(u=>u.type==="soldier").length,as);assert.equal(g.players[1].units.filter(u=>u.type==="soldier").length,ds);
    if(as) assert.ok(g.players[0].units.filter(u=>u.type==="soldier").every(u=>u.x===3&&u.acted&&u.moves===0));
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

test("tour : plaines et forêts uniquement, avec ou sans drapeau",()=>{
  for (const terrain of ["plain","forest"]) {
    const g=game();prepareBuilding(g,"outpost");g.board["2,2"].terrain=terrain;
    assert.equal(buildError(g,0,2,2),null);build(g,0,2,2);
    assert.equal(g.board["2,2"].building.type,"outpost");
    assert.equal(g.board["2,2"].terrain,terrain);
    endTurn(g);endTurn(g);g.buildingMarket[0]="outpost";
    assert.match(buildError(g,0,2,2),/overlaps/);
  }
  for (const terrain of ["mountain", "river", "field"]) {
    const blocked=game();prepareBuilding(blocked,"outpost");blocked.board["2,2"].terrain=terrain;
    const before=structuredClone(blocked);assert.match(buildError(blocked,0,2,2),/incompatible terrain/);
    assert.throws(()=>build(blocked,0,2,2));assert.deepEqual(blocked,before);
  }
  const g=game();prepareBuilding(g,"outpost");g.board["2,2"].flag={owner:null};
  build(g,0,2,2);assert.equal(g.board["2,2"].flag.owner,0);
});

test("garnison renforcée : aucun bonus défensif et garnison retirée en dernier",()=>{
  const g=game();g.board["3,2"].building={type:"outpost",owner:1};
  soldiers(g,1,5,3,2);const units=soldiers(g,0,5,2,2);selectUnit(g,units[0].id);
  assert.equal(combatPreview(g,3,2).defense,7);attack(g,3,2);
  assert.equal(armyAt(g,1,3,2).length,0);assert.ok(g.board["3,2"].building);
});

test("le bonus des soldats ne se cumule pas avec la force fixe d'une tour ou du donjon", () => {
  for (const type of ["outpost", "castle"]) {
    const g = game();
    g.board["3,2"].building = { type, owner: 1 };
    assert.deepEqual(defenseAt(g, 1, 3, 2), { defenders: 0, garrison: 2, bonus: 0, defense: 2 });
    soldiers(g, 1, 1, 3, 2);
    assert.deepEqual(defenseAt(g, 1, 3, 2), { defenders: 1, garrison: 2, bonus: 0, defense: 3 });
    const units = soldiers(g, 0, 4, 2, 2);
    selectUnit(g, units[0].id);
    assert.equal(combatPreview(g, 3, 2).defense, 3);
    attack(g, 3, 2);
    assert.equal(armyAt(g, 0, 3, 2).length, 1);
    assert.equal(armyAt(g, 1, 3, 2).length, 0);
  }
  const g = game();
  soldiers(g, 0, 1, 3, 2);
  assert.equal(defenseAt(g, 0, 3, 2).defense, 2);
  g.board["3,2"].building = { type: "farm", owner: 0 };
  assert.equal(defenseAt(g, 0, 3, 2).defense, 2);
});

test("donjon : une égalité conserve le donjon ; une occupation termine immédiatement",()=>{
  const g=game(), {x,y}=g.players[1].home;
  g.board[key(x-1,y)]={terrain:"plain"};
  let units=soldiers(g,0,2,x-1,y);selectUnit(g,units[0].id);attack(g,x,y);
  assert.equal(g.finished,false);assert.ok(g.board[key(x,y)].building);
  units=soldiers(g,0,3,x-1,y);selectUnit(g,units[0].id);attack(g,x,y);
  assert.equal(g.finished,true);assert.equal(g.winner,0);assert.equal(g.victory,"conquest");
  assert.equal(armyAt(g,0,x,y).length,1);assert.throws(()=>endTurn(g),/game is over/);
  validateGame(g);
});

test("drapeaux : capture persistante, recapture et score sans garnison obligatoire",()=>{
  const g=game();g.board["3,2"].flag={owner:null};
  let u=soldiers(g,0,1,2,2)[0];selectUnit(g,u.id);attack(g,3,2);
  assert.equal(missionProgress(g, "conquests-8", 0), 1);
  endTurn(g);endTurn(g);selectUnit(g,u.id);move(g,4,2);
  assert.equal(g.board["3,2"].flag.owner,0);assert.equal(score(g,0).flags,RULES.points.flag);
  endTurn(g);u=soldiers(g,1,1,3,3)[0];selectUnit(g,u.id);attack(g,3,2);
  assert.equal(g.board["3,2"].flag.owner,1);
});

test("les ouvriers capturent les drapeaux libres en passant, sauf présence adverse",()=>{
  for(const owner of [null,0,1]){
    const g=game(), worker=g.players[0].units.find(u=>u.type==='worker');
    Object.assign(worker,{x:2,y:2,moves:3,acted:false,ended:false});selectUnit(g,worker.id);
    g.board['3,2'].flag={owner};
    move(g,3,2);assert.equal(g.board['3,2'].flag.owner,0);
    assert.equal(missionProgress(g, "conquests-8"), owner === 0 ? 0 : 1);
    assert.equal(score(g,0).flags,RULES.points.flag);
    move(g,2,2);worker.moves=2;g.board['3,2'].flag.owner=owner;moveUnitTo(g,4,2);
    assert.deepEqual({x:worker.x,y:worker.y},{x:4,y:2});
    assert.equal(g.board['3,2'].flag.owner,0);
    Object.assign(worker,{x:2,y:2,moves:1});
    g.board['3,2'].flag.owner=owner;
    g.board['3,2'].building={type:'outpost',owner:1};
    assert.throws(()=>move(g,3,2));assert.throws(()=>moveUnitTo(g,3,2));
    delete g.board['3,2'].building;
    soldiers(g,1,1,3,2);
    assert.throws(()=>move(g,3,2));assert.throws(()=>moveUnitTo(g,3,2));
    g.players[1].units=g.players[1].units.filter(u=>u.type!=='soldier');
    Object.assign(g.players[1].units[0],{x:3,y:2});
    assert.throws(()=>move(g,3,2));assert.throws(()=>moveUnitTo(g,3,2));
    assert.equal(g.board['3,2'].flag.owner,owner);
  }
});

test("ouvrier : capture des bâtiments sans défense, sans destruction ni réinitialisation",()=>{
  for(const active of [0,1]){
    const g=game();g.active=active;
    const worker=g.players[active].units.find(u=>u.type==='worker');
    Object.assign(worker,{x:2,y:2,moves:3,acted:false,ended:false});selectUnit(g,worker.id);
    const building={type:'farm',owner:1-active,rotation:2,productionRound:g.round};
    g.board['3,2']={terrain:'plain',building,flag:{owner:1-active}};
    const captured=applyCommand(g,{type:'moveUnitTo',unit:worker.id,args:[3,2]});
    assert.deepEqual(captured.board['3,2'].building,{...building,owner:active});
    assert.equal(captured.board['3,2'].flag.owner,active);
    assert.equal(captured.players[active].units.find(u=>u.id===worker.id).moves,2);
    assert.equal(g.board['3,2'].building.owner,1-active);
    validateGame(captured);
    for(const type of ['outpost','castle']){
      g.board['3,2'].building={type,owner:1-active};
      assert.throws(()=>move(g,3,2));assert.throws(()=>moveUnitTo(g,3,2));
    }
    for(const type of ['worker','soldier']){
      g.board['3,2'].building=building;
      const defender=g.players[1-active].units[0];
      Object.assign(defender,{type,x:3,y:2});
      assert.throws(()=>move(g,3,2));assert.throws(()=>moveUnitTo(g,3,2));
      assert.equal(building.owner,1-active);
    }
  }
});

test("destruction : seulement la case du bâtiment, empreinte libérée et ouvriers rendus",()=>{
  const g=game();prepareBuilding(g,"farm",5,4);build(g,0,5,4);
  assert.equal(g.board["5,3"].overlay,undefined);
  endTurn(g);
  const u=soldiers(g,1,1,4,3)[0];selectUnit(g,u.id);
  assert.ok(attackError(g,5,3)); // Auxiliary field is not a military target.
  move(g,5,3);attack(g,5,4);
  assert.equal(g.board["5,4"].building,undefined);
  assert.deepEqual([g.players[0].units[0].x,g.players[0].units[0].y],[g.players[0].home.x,g.players[0].home.y]);
  for(const c of patternAt("farm",5,4)) {
    assert.equal(g.board[key(c.x,c.y)].overlay,undefined);
    assert.equal(g.board[key(c.x,c.y)].terrain,"plain");
  }
  assert.equal(g.players[0].workers,2);
});

test("une maison détruite supprime son ouvrier, une caserne conserve ses soldats",()=>{
  const g=game();prepareBuilding(g,"house");build(g,0,2,2);
  const workers=g.players[0].workers, worker=g.players[0].units.at(-1);
  Object.assign(worker,{x:4,y:2});
  destroyBuilding(g,2,2);assert.equal(g.players[0].workers,workers-1);
  assert.ok(!g.players[0].units.some(u=>u.id===worker.id));
  assert.equal(g.buildingDeck.at(-1),"house");
  const snapshot=structuredClone(g);destroyBuilding(g,2,2);assert.deepEqual(g,snapshot);
  g.board["3,2"].building={type:"barracks",owner:0};soldiers(g,0,3,4,2);
  destroyBuilding(g,3,2);assert.equal(g.players[0].units.filter(u=>u.type==="soldier").length,3);
});

test("ouvrier capturé : retour au donjon et activation au prochain tour",()=>{
 const g=game(),worker=g.players[1].units[0];Object.assign(worker,{x:3,y:2});
 selectUnit(g,soldiers(g,0,1,2,2)[0].id);attack(g,3,2);
 assert.deepEqual([worker.x,worker.y],[g.players[1].home.x,g.players[1].home.y]);assert.ok(worker.ended);
 endTurn(g);assert.equal(worker.ended,false);assert.equal(worker.moves,3);
});

test("maisons : le lien survit à une capture et à la sérialisation sans toucher les autres ouvriers", () => {
  const g=game();
  prepareBuilding(g,"house");build(g,0,2,2);
  const firstWorker=g.players[0].units.at(-1).id;
  endTurn(g);endTurn(g);
  prepareBuilding(g,"house_water",4,2);build(g,0,4,2);
  const otherWorker=g.players[0].units.at(-1).id;
  g.board["2,2"].building.owner=1;
  const restored=JSON.parse(JSON.stringify(g));
  restored.active=0;restored.selectedUnitId=firstWorker;
  destroyBuilding(restored,2,2);
  assert.equal(restored.selectedUnitId,null);
  assert.equal(restored.players[0].workers,3);
  assert.equal(restored.players[1].workers,2);
  assert.ok(restored.players[0].units.some(u=>u.id===otherWorker));
  assert.ok(!restored.players[0].units.some(u=>u.id===firstWorker));
  assert.deepEqual(restored.buildingDeck.slice(-1),["house"]);
  validateGame(restored);
});

test("destruction : chaque bâtiment revient en fin de pioche avec sa variante exacte", () => {
  for (const type of ["outpost", "barracks_forest", "house_water", "bridge", "tunnel", "farm_t"]) {
    const g=game(), deck=[...g.buildingDeck];
    g.board["3,2"].building={type,owner:1};
    destroyBuilding(g,3,2);
    assert.deepEqual(g.buildingDeck,[...deck,type]);
    assert.equal(g.board["3,2"].building,undefined);
  }
});

test("plusieurs ouvriers capturés reviennent ensemble au donjon",()=>{
 const g=game();for(const u of g.players[1].units)Object.assign(u,{x:3,y:2});
 selectUnit(g,soldiers(g,0,1,2,2)[0].id);attack(g,3,2);
 assert.ok(g.players[1].units.every(u=>u.x===g.players[1].home.x&&u.ended));
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
  assert.match(html, /sword\.svg/);
  assert.match(html, /shield\.svg/);
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
  assert.equal(g.players[0].units.filter(u=>u.type==="soldier").length, 0);
  assert.equal(hasSelectedUnit(g, ui), false);
});

test("les recrues grisées ne repartent pas en fusionnant et les soldats ne bâtissent pas",()=>{
  const g=game(), fresh=soldiers(g,0,1,2,2)[0];soldiers(g,0,2,2,2,{ended:true,moves:0});
  selectUnit(g,fresh.id);assert.equal(selectedSoldiers(g).length,1);move(g,3,2);
  assert.equal(armyAt(g,0,2,2).length,2);
  assert.match(buildError(g,0,3,2),/cannot build/);
  assert.match(exploreError(g,0,3,3),/cannot explore/);
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
  assert.match(tradeView(g), /2 <img[^>]+gold\.svg[^>]*> → <img[^>]+wheat\.svg/);
  assert.match(tradeView(g), /4 <img[^>]+gold\.svg[^>]*> → <img[^>]+wood\.svg/);
});

test("achat à la construction : confirmation exacte, paiement atomique et or non achetable",()=>{
  const g=game();prepareBuilding(g,"house");g.players[0].resources={material:0,food:1,gold:15};
  const before=structuredClone(g);
  assert.throws(()=>build(g,0,2,2,0,{allowGold:true,expectedGold:1}),/changed/);
  assert.deepEqual(g,before);build(g,0,2,2,0,{allowGold:true,expectedGold:14});
  assert.deepEqual(g.players[0].resources,{material:0,food:0,gold:0});
  assert.equal(costPayment(g,{gold:1}).affordable,false);
});

test("recrutement avec achat à la banque et quota indépendant de la construction",()=>{
  const g=game();prepareBuilding(g,"barracks");build(g,0,2,2);
  g.players[0].resources={material:0,food:0,gold:4};trainUnit(g,2,2,"soldier");
  assert.equal(g.players[0].resources.gold,0);assert.equal(g.players[0].units.filter(u=>u.type==="soldier").length,1);
});

test("décompte : bâtiments à points et drapeaux après 50 tours individuels",()=>{
  const g=createGame();g.board["2,2"]={terrain:"plain",building:{type:"monument",owner:0}};
  g.board["6,6"].flag.owner=0;
  assert.equal(totalScore(g,0),BUILDINGS.monument.points+RULES.points.flag);
  for(let i=0;i<49;i++) endTurn(g);assert.equal(g.finished,false);
  endTurn(g);assert.equal(g.finished,true);assert.equal(g.round,25);
  assert.match(rulesView(),/25 tours/);
});

test("banques des deux joueurs : affichage permanent et prix propres à chaque royaume",()=>{
 const g=game();g.board["2,2"].building={type:"sawmill",owner:0};g.board["3,2"].building={type:"farm",owner:1};
 assert.equal(tradePrice(g,"food",0),3);assert.equal(tradePrice(g,"material",0),2);
 assert.equal(tradePrice(g,"food",1),2);assert.equal(tradePrice(g,"material",1),3);
 for(const active of [0,1]){
  g.active=active;const markup=playersView(g);assert.equal((markup.match(/class="player-bank"/g)||[]).length,2);
  const players=markup.split('<article').slice(1);assert.match(players[0],/Banque<\/strong> · 3/);assert.match(players[1],/Banque<\/strong> · 2/);
 }
});

test("les stocks ne donnent plus de points", () => {
  const g = createGame(); g.players[0].resources = { material: 100, food: 100, gold: 100 };
  assert.deepEqual(score(g,0), {buildings:0, flags:0});
});

test("recrutement : quotas distincts et refus atomiques",()=>{
 const g=createGame();for(const x of [2,4])g.board[key(x,6)]={terrain:"plain",building:{type:"barracks",owner:0}};
 g.players[0].resources.food=10;trainUnit(g,2,6,"soldier");trainUnit(g,4,6,"soldier");
 const before=structuredClone(g);assert.throws(()=>trainUnit(g,2,6,"soldier"));assert.deepEqual(g,before);
 assert.ok(trainError(g,2,6,"worker"));g.finished=true;assert.ok(trainError(g,4,6,"soldier"));
});
