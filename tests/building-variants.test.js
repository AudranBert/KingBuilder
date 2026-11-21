import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUILDINGS,createGame,patternAt,buildError,build,selectUnit} from '../src/engine.js';
import {rotatePoint} from '../src/geometry.js';
import {buildingDiagram} from '../src/ui/html.js';

function fixture(type,rotation=0) {
  const g=createGame(()=>0.5,'solo');
  g.board={};g.players[0].resources={material:30,food:30,gold:30};
  Object.assign(g.players[0].units[0],{x:4,y:4});selectUnit(g,0);g.buildingMarket=[type];
  const b=BUILDINGS[type], cells=patternAt(type,4,4,rotation);
  for(const c of cells)g.board[`${c.x},${c.y}`]={terrain:c.terrain[0],...(c.symbol==='c'?{building:{type:'house',owner:0}}:{})};
  if(b.toll)for(const direction of [-1,1]){const c=rotatePoint(direction,0,rotation);g.board[`${4+c.x},${4+c.y}`]={terrain:'mountain'};}
  return g;
}

test('deux patterns distincts par famille, sauf tier 0, tour et donjon',()=>{
  const families=new Map();
  for(const b of Object.values(BUILDINGS)){const id=b.family||b.id;if(!families.has(id))families.set(id,[]);families.get(id).push(b);}
  for(const [id,variants] of families){
    if(variants[0].tier===0||['outpost','castle'].includes(id))continue;
    assert.ok(variants.length>=2,id);
    const signatures=variants.map(b=>JSON.stringify(b.cells.map(c=>[c.x,c.y,c.symbol,c.terrain]).sort()));
    assert.equal(new Set(signatures).size,variants.length,id);
    for(const b of variants){assert.equal(b.icon,variants[0].icon);assert.deepEqual(b.cost,variants[0].cost);}
  }
});

test('patterns : tier 2 au moins deux cases, tier 3 au moins trois cases requises',()=>{
  for(const b of Object.values(BUILDINGS))if(b.tier>=2&&!['outpost','castle'].includes(b.id))assert.ok(b.cells.length>=(b.tier>=3?3:2),b.id);
});

test('chaque pattern se construit dans ses quatre orientations',()=>{
  for(const b of Object.values(BUILDINGS).filter(b=>b.constructible!==false))for(let r=0;r<4;r++){
    const g=fixture(b.id,r);
    assert.equal(buildError(g,0,4,4,r),null,`${b.id}, rotation ${r}`);
    const neighbours=patternAt(b.id,4,4,r).filter(c=>c.symbol!=='B').map(c=>[`${c.x},${c.y}`,structuredClone(g.board[`${c.x},${c.y}`])]);
    build(g,0,4,4,r);
    for(const [key,before] of neighbours)assert.deepEqual(g.board[key],before,`${b.id}: voisin préservé`);
  }
});

test('maison : bâtiment existant requis, ponts et tunnels exclus',()=>{
  for(const type of ['house','farm','bridge','tunnel','great_bridge',null]){
    const g=fixture('house');g.board['5,4']={terrain:'plain',...(type?{building:{type,owner:0}}:{})};
    if(['house','farm'].includes(type))assert.equal(buildError(g,0,4,4),null,type);
    else assert.ok(buildError(g,0,4,4),type);
  }
  const g=fixture('house');g.board['4,4'].terrain='forest';assert.ok(buildError(g,0,4,4));
});

test('maisons de rive et de forêt : voisin requis et conservé',()=>{
  for(const [type,terrain] of [['house_water','river'],['house_forest','forest']]){
    const g=fixture(type);g.board['5,4'].terrain='plain';assert.ok(buildError(g,0,4,4));
    g.board['5,4']={terrain};assert.equal(buildError(g,0,4,4),null);build(g,0,4,4);
    assert.deepEqual(g.board['5,4'],{terrain});assert.equal(g.players[0].units.length,3);
    assert.doesNotMatch(buildingDiagram(type),/dashed/);
  }
});

test('corrections de terrain du catalogue',()=>{
  assert.deepEqual(BUILDINGS.quarry_mountain.terrain,['plain']);
  assert.deepEqual(BUILDINGS.mill.layout,['Bw']);
  assert.deepEqual(BUILDINGS.mill_line.layout,['Bc']);
  assert.deepEqual(BUILDINGS.barracks.layout,['Bc']);
  assert.deepEqual(BUILDINGS.monument.cells[3].terrain,['forest']);
  assert.deepEqual(BUILDINGS.small_monument.cells[1].terrain,['mountain']);
  assert.deepEqual(BUILDINGS.small_monument_forest.cells[1].terrain,['river']);
  assert.deepEqual(BUILDINGS.large_fisher_line.cells[4].terrain,['plain']);
  assert.deepEqual(BUILDINGS.stable_forest.cells[1].terrain,['river']);
  for(const id of ['stable','stable_forest','dry_dock','dry_dock_forest'])assert.equal(BUILDINGS[id].cells.length,3,id);
  for(const id of ['large_quarry','large_quarry_line']){
    const cells=BUILDINGS[id].cells;
    assert.deepEqual(cells[0].terrain,['plain']);
    assert.equal(cells.filter(c=>c.terrain[0]==='mountain').length,2);
    assert.equal(cells.filter(c=>c.terrain[0]==='forest').length,2);
  }
});

test('les champs et bâtiments requis par moulin et caserne restent intacts',()=>{
  for(const type of ['mill','mill_line','barracks']){
    const g=fixture(type);
    g.board['5,4']=type==='mill'
      ? {terrain:'field',overlay:{anchor:'6,4',role:'field',owner:0}}
      : {terrain:'plain',building:{type:'farm',owner:0}};
    const before=structuredClone(g.board['5,4']);
    assert.equal(buildError(g,0,4,4),null,type);
    build(g,0,4,4);
    assert.deepEqual(g.board['5,4'],before,type);
  }
});

test('grand pont : deux eaux et deux rives obligatoires, en plaine ou forêt',()=>{
  for(const type of ['great_bridge','great_bridge_bend'])for(let rotation=0;rotation<4;rotation++){
    const g=fixture(type,rotation),banks=patternAt(type,4,4,rotation).filter(c=>c.symbol==='l');
    assert.equal(banks.length,2);
    assert.equal(BUILDINGS[type].cells.filter(c=>['B','r'].includes(c.symbol)).length,2);
    for(const bank of banks)g.board[`${bank.x},${bank.y}`].terrain='forest';
    assert.equal(buildError(g,0,4,4,rotation),null,type);
    const position=`${banks[0].x},${banks[0].y}`;
    delete g.board[position];assert.ok(buildError(g,0,4,4,rotation),type);
    g.board[position]={terrain:'mountain'};assert.ok(buildError(g,0,4,4,rotation),type);
    g.board[position]={terrain:'plain'};assert.equal(buildError(g,0,4,4,rotation),null,type);
    build(g,0,4,4,rotation);assert.deepEqual(g.board[position],{terrain:'plain'});
  }
});
