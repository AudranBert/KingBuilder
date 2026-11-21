import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile,mkdtemp,cp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {compileConfiguration} from "../src/config-schema.js";
import {BUILDING_CONFIGURATION,TERRAIN_TILE_CONFIGURATION} from "../src/configuration.js";
const names=["terrain-tiles","buildings","resources","units","game-rules","terrains","missions"];
const originals=await Promise.all(names.map(n=>n==="terrain-tiles"?TERRAIN_TILE_CONFIGURATION:n==="buildings"?BUILDING_CONFIGURATION:readFile(new URL(`../config/${n}.json`,import.meta.url),"utf8").then(JSON.parse)));
const configs=()=>structuredClone(originals);
test("configuration sans mutation : trois ressources, deux unités et nouveaux bâtiments",()=>{
 const input=configs(),before=structuredClone(input),c=compileConfiguration(...input);
 assert.deepEqual(input,before);assert.equal(Object.keys(c.shapes).length,13);assert.equal(Object.keys(c.resources).length,3);
 assert.equal(Object.keys(c.units).length,2);assert.equal(c.units.soldier.moves,3);assert.equal(c.units.emissary,undefined);assert.equal(c.units.king,undefined);assert.equal(c.units.worker.moves,3);assert.equal(c.units.worker.recruitment,"house");
 assert.equal(c.buildings.chancellery,undefined);assert.equal(c.buildings.castle.garrison,1);assert.equal(c.rules.turnLimit,25);
});
test("pioche : chaque exemplaire et chaque variante sont conservés, quantités par famille et variantes conservées",()=>{
 const c=compileConfiguration(...configs()),counts={};assert.equal(c.buildingDeckSize,118);
 for(const id of c.buildingPool){const family=c.buildings[id].family||id;counts[family]=(counts[family]||0)+1;}
 assert.deepEqual(counts,{house:7,farm:6,sawmill:6,quarry:6,mine:6,bridge:6,tunnel:6,port:5,clearing:8,mill:5,barracks:6,outpost:6,monument:5,fisher:6,small_monument:2,market:2,wood_mill:2,stable:2,forge:2,barrack_block:2,dry_dock:2,large_monument:2,church:2,toll:2,explorer_guild:2,builder_guild:2,great_bridge:2,large_farm:2,large_sawmill:2,large_quarry:2,large_fisher:2});
 assert.equal(c.buildingPool.length,c.buildingDeckSize);assert.equal(counts.castle,undefined);
 for(const family of ["farm","sawmill","quarry","mine","port","mill","fisher"]){
 const variants=Object.values(c.buildings).filter(b=>(b.family||b.id)===family);assert.equal(variants.length,3);
 for(const b of variants){assert.deepEqual(b.cost,c.buildings[family].cost);assert.equal(b.production,c.buildings[family].production);}}
});
test("motifs vides, disjoints, symboles inconnus et entrées multiples refusés",()=>{
 for(const pattern of [["..."],["x.x"],["xy"]]){const c=configs();c[0].shapes[0].pattern=pattern;assert.throws(()=>compileConfiguration(...c),/terrain-tiles/);}
 for(const layout of [["ff"],["BB"],["Bz"]]){const c=configs();c[1].buildings[0].layout=layout;assert.throws(()=>compileConfiguration(...c),/buildings/);}
});
test("les grandes formes restent configurables",()=>{
 const c=configs();c[0].shapes.push({id:"future6",name:"Six",weight:1,pattern:["xxxxxx"]});
 c[1].buildings[0].layout=["Bppppp"];
 const result=compileConfiguration(...c);assert.equal(result.shapes.future6.cells.length,6);assert.equal(result.buildings.house.cells.length,6);
});
test('alphabet commun des bâtiments : B, c et terrains fixes sans légende',()=>{
 for(const b of originals[1].buildings){assert.equal(b.legend,undefined);assert.equal(b.bridgeBanks,undefined);}
 const c=configs();c[1].buildings[0].layout=['Bpfmrwl'];
 const house=compileConfiguration(...c).buildings.house;
 assert.deepEqual(house.cells.map(c=>c.symbol),['B','p','f','m','r','w','l']);
 assert.deepEqual(house.cells.slice(1).map(c=>c.terrain),[['plain'],['forest'],['mountain'],['river'],['field'],['plain','forest']]);
 assert.ok(house.cells.every(c=>c.role===undefined));
});
test('bc est accepté pour une maison à côté d’un bâtiment',()=>{
 const c=configs();c[1].buildings[0].layout=['bc'];
 const house=compileConfiguration(...c).buildings.house;
 assert.deepEqual(house.layout,['Bc']);assert.deepEqual(house.cells.map(c=>c.symbol),['B','c']);
 assert.deepEqual(c[1].buildings[0].layout,['bc']);
});
test("références de ressources, terrains, unités et bonus invalides refusées",()=>{
 for(const change of [c=>c[1].buildings[0].cost={missing:1},c=>c[1].buildings[0].terrain=["missing"],
 c=>c[1].buildings.find(b=>b.id==="barracks").trains=["worker"],c=>c[1].buildings.find(b=>b.id==="barracks").trains=["missing"],
 c=>c[1].buildings.find(b=>b.id==="mill").boost.target="house",c=>c[1].buildings.find(b=>b.id==="barracks").onBuildUnit="missing"]){
 const input=configs();change(input);assert.throws(()=>compileConfiguration(...input),/Configuration invalide/);}
});
test("identifiants en double et poids dépassant la pioche ou la famille refusés",()=>{
 const a=configs();a[0].shapes.push(a[0].shapes[0]);assert.throws(()=>compileConfiguration(...a),/double/);
 const b=configs();b[1].buildings[0].weight=b[1].deckSize+1;assert.throws(()=>compileConfiguration(...b),/poids/);
 const c=configs();c[1].buildings[0].weight=13;c[1].buildings.find(b=>b.id==="clearing").weight=1;c[1].deckSize=c[1].buildings.reduce((n,b)=>n+(b.constructible===false?0:b.weight),0);assert.throws(()=>compileConfiguration(...c),/maxFamilyCopies/);
});
test("ouvrier obligatoire et mobile, coûts négatifs refusés",()=>{
 for(const change of [c=>c[3].units=c[3].units.filter(u=>u.id!=="worker"),
 c=>c[3].units.find(u=>u.id==="worker").moves=0,c=>c[3].units[0].cost={food:-1},c=>c[3].units[0].moves=-1,
 c=>c[3].units[0].recruitment="direct"]){const input=configs();change(input);assert.throws(()=>compileConfiguration(...input),/units.json/);}
});
test("les cinq drapeaux, le commerce et les valeurs de score sont validés",()=>{
 for(const change of [c=>c[4].flags.pop(),c=>c[4].flags[0].x=99,c=>c[4].flags[0]=c[4].flags[1],
 c=>c[4].trade.basePrice=0,c=>c[4].scoring.flag=-1,c=>c[1].buildings[0].points=-1,c=>c[4].turnLimit=0]){
 const input=configs();change(input);assert.throws(()=>compileConfiguration(...input),/Configuration invalide/);}
});
test("missions : or uniquement, familles complètes et seuils croissants",()=>{
 for(const change of [c=>c[6].missions[0].reward={prestige:1},c=>c[6].missions[0].reward.gold=0,
 c=>c[6].missions.pop(),c=>c[6].missions[1].target=1,c=>c[6].missions[0].resource="missing"]){
 const input=configs();change(input);assert.throws(()=>compileConfiguration(...input),/missions.json/);}
});
test("configuration réelle : coûts, score et quota des casernes suivent les fichiers",async()=>{
 const root=await mkdtemp(path.join(tmpdir(),"kingbuilder-duel-"));
 try{
 await cp(new URL("../src/",import.meta.url),path.join(root,"src"),{recursive:true});
 await cp(new URL("../config/",import.meta.url),path.join(root,"config"),{recursive:true});
 await writeFile(path.join(root,"package.json"),'{"type":"module"}');
 const input=configs();input[4].turnLimit=2;input[4].scoring.flag=7;
 input[1].buildings.find(b=>b.id==="house").cost={material:2,food:2};input[1].buildings.find(b=>b.id==="house").points=3;
 input[1].buildings.find(b=>b.id==="barracks").trainingLimit=2;
 for(let i=0;i<names.length;i++){
 if(names[i]==="terrain-tiles")continue;
 if(names[i]==="buildings"){
 const index=JSON.parse(await readFile(path.join(root,"config/buildings/index.json"),"utf8"));
 for(const family of index.files)await writeFile(path.join(root,"config/buildings",family+".json"),JSON.stringify(input[i].buildings.filter(b=>(b.family||b.id)===family)));
 }else await writeFile(path.join(root,"config",names[i]+".json"),JSON.stringify(input[i]));
 }
 const engine=await import(pathToFileURL(path.join(root,"src/engine.js")));
 const g=engine.createGame();g.board["1,6"]={terrain:"plain"};g.buildingMarket[0]="house";engine.build(g,0,1,6,2);
 assert.equal(g.players[0].resources.material,1);assert.equal(g.players[0].resources.food,0);assert.equal(engine.score(g,0).buildings,3);
 g.board["6,6"].flag.owner=0;assert.equal(engine.score(g,0).flags,7);
 for(let i=0;i<4;i++)engine.endTurn(g);assert.equal(g.finished,true);
 }finally{
 const resolved=path.resolve(root);if(path.dirname(resolved)!==path.resolve(tmpdir())||!path.basename(resolved).startsWith("kingbuilder-duel-"))throw Error("Chemin temporaire inattendu");
 await rm(resolved,{recursive:true,force:true});}
});
