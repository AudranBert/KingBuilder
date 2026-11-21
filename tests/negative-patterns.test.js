import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileConfiguration} from '../src/config-schema.js';
import {BUILDING_CONFIGURATION,TERRAIN_TILE_CONFIGURATION} from '../src/configuration.js';
import {BUILDINGS,createGame,patternAt,buildError,build,selectUnit} from '../src/engine.js';
import {buildingDiagram} from '../src/ui/html.js';

const originals=await Promise.all(['terrain-tiles','buildings','resources','units','game-rules','terrains','missions']
  .map(async name=>name==='terrain-tiles'?TERRAIN_TILE_CONFIGURATION:name==='buildings'?BUILDING_CONFIGURATION:JSON.parse(await readFile(new URL(`../config/${name}.json`,import.meta.url),'utf8'))));
function definition(layout){
  const configs=structuredClone(originals);
  const house=configs[1].buildings.find(b=>b.id==='house');house.layout=layout;house.terrain='plain';
  return compileConfiguration(...configs).buildings.house;
}
function using(layout,callback){
  const original=BUILDINGS.house;BUILDINGS.house=definition(layout);
  try{return callback();}finally{BUILDINGS.house=original;}
}
function game(rotation=0,terrain='forest'){
  const g=createGame(()=>0.5,'solo');g.board={};g.players[0].resources={food:30,material:30,gold:30};
  Object.assign(g.players[0].units[0],{x:4,y:4});selectUnit(g,0);g.buildingMarket=['house'];
  for(const c of patternAt('house',4,4,rotation))g.board[`${c.x},${c.y}`]={terrain:c.symbol==='B'?'plain':terrain};
  return g;
}

test('!p représente une case : mêmes positions en écriture verticale ou horizontale',()=>{
  const vertical=definition(['!p','B','!p']),horizontal=definition(['!pB!p']);
  assert.deepEqual(vertical.cells.map(c=>[c.x,c.y]),[[0,-1],[0,0],[0,1]]);
  assert.deepEqual(horizontal.cells.map(c=>[c.x,c.y]),[[-1,0],[0,0],[1,0]]);
  for(const b of [vertical,horizontal])for(const c of b.cells.filter(c=>c.symbol==='!p')){
    assert.deepEqual(c.terrain,['forest','mountain','river','field']);assert.equal(c.excludedTerrain,'plain');
  }
});

test('les deux côtés acceptent les terrains hors plaine dans les quatre orientations',()=>{
  using(['!p','B','!p'],()=>{
    for(let rotation=0;rotation<4;rotation++)for(const terrain of ['forest','mountain','river','field']){
      const g=game(rotation,terrain),before=structuredClone(g.board);
      assert.equal(buildError(g,0,4,4,rotation),null,`${terrain}, ${rotation}`);build(g,0,4,4,rotation);
      for(const [key,cell] of Object.entries(before))if(key!=='4,4')assert.deepEqual(g.board[key],cell);
    }
  });
});

test('une plaine ou une case inconnue de chaque côté refuse la construction',()=>{
  using(['!pB!p'],()=>{
    for(const position of ['3,4','5,4']){
      const g=game();g.board[position]={terrain:'plain'};assert.ok(buildError(g,0,4,4));
      delete g.board[position];assert.ok(buildError(g,0,4,4));
    }
  });
});

test('la négation reste réservée aux terrains et un seul B est accepté',()=>{
  for(const layout of [['B!'],['B!c'],['B!B'],['B!q'],['B','B','f']])assert.throws(()=>definition(layout),/Configuration invalide/);
  for(const [symbol,terrain] of [['p','plain'],['f','forest'],['m','mountain'],['r','river'],['w','field']]){
    const cell=definition([`B!${symbol}`]).cells[1];assert.ok(!cell.terrain.includes(terrain));
  }
});

test('les trous dans un pattern de conditions sont autorisés',()=>{
  using(['B.c'],()=>{
    const g=game();g.board['6,4']={terrain:'plain',building:{type:'farm',owner:0}};
    assert.equal(g.board['5,4'],undefined);assert.equal(buildError(g,0,4,4),null);
    build(g,0,4,4);assert.equal(g.board['5,4'],undefined);assert.equal(g.board['6,4'].building.type,'farm');
  });
});

test('!p utilise la case à trois terrains avec une infobulle',()=>{
  using(['!p','B','!p'],()=>{
    const html=buildingDiagram('house');assert.equal((html.match(/terrain-choice/g)||[]).length,2);
    assert.equal((html.match(/terrains-not-plain.svg/g)||[]).length,2);
    assert.doesNotMatch(html,/excluded-terrain/);
    assert.match(html,/Tout terrain sauf Plaine/);
  });
});

test('c utilise le symbole de mur générique, distinct de la maison à poser',()=>{
  using(['Bc'],()=>{
    const html=buildingDiagram('house');
    assert.equal((html.match(/pattern-building.svg/g)||[]).length,1);
    assert.equal((html.match(/buildings-house.svg/g)||[]).length,1);
  });
  for(const b of Object.values(BUILDINGS)){
    const count=b.cells.filter(c=>c.symbol==='c').length;
    if(count)assert.equal((buildingDiagram(b.id).match(/pattern-building.svg/g)||[]).length,count,b.id);
  }
});

test('les autres exclusions gardent le terrain exclu barré',()=>{
  using(['B!f'],()=>assert.match(buildingDiagram('house'),/excluded-terrain/));
});
