import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUILDINGS,createGame,patternAt,buildError,build,selectUnit} from '../src/engine.js';
import {rotatePoint} from '../src/geometry.js';

function fixture(type,rotation=0) {
  const g=createGame(()=>0.5,'solo');
  g.board={};g.players[0].resources={material:30,food:30,gold:30};
  Object.assign(g.players[0].units[0],{x:4,y:4});selectUnit(g,0);g.buildingMarket=[type];
  const b=BUILDINGS[type], cells=patternAt(type,4,4,rotation);
  for(const c of cells)g.board[`${c.x},${c.y}`]={terrain:c.terrain[0],...(c.symbol==='c'?{building:{type:'house',owner:0}}:{})};
  if(b.toll)for(const direction of [-1,1]){const c=rotatePoint(direction,0,rotation);g.board[`${4+c.x},${4+c.y}`]={terrain:'mountain'};}
  return g;
}

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

test('péages : plaine, forêt ou pont, sans obligation de montagnes',()=>{
  for(const type of ['toll','toll_forest'])for(const terrain of ['plain','forest','river','mountain']){
    const g=fixture(type);
    // Preserve each variant's layout while removing the old mountain constraint.
    g.board['3,4']={terrain:'forest'};g.board['5,4']={terrain:'forest'};
    g.board['4,4']={terrain};
    if(['plain','forest'].includes(terrain))assert.equal(buildError(g,0,4,4),null,`${type}: ${terrain}`);
    else assert.ok(buildError(g,0,4,4),`${type}: ${terrain}`);
    if(terrain==='river'){
      g.board['4,4'].building={type:'bridge',owner:1};
      assert.ok(buildError(g,0,4,4),'pont adverse');
      g.board['4,4'].building.owner=0;
      assert.equal(buildError(g,0,4,4),null,`${type}: pont`);
      build(g,0,4,4);assert.equal(g.board['4,4'].building.type,type);
    }
  }
});

test('maisons de rive et de forêt : voisin requis et conservé',()=>{
  for(const [type,terrain] of [['house_water','river'],['house_forest','forest']]){
    const g=fixture(type);g.board['5,4'].terrain='plain';assert.ok(buildError(g,0,4,4));
    g.board['5,4']={terrain};assert.equal(buildError(g,0,4,4),null);build(g,0,4,4);
    assert.deepEqual(g.board['5,4'],{terrain});assert.equal(g.players[0].units.length,3);
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
