import { openingError } from "./helpers.js";
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, playerOrder, nextPlayer, endTurn, startOpening, placeOpeningTile, eliminatePlayer } from '../src/engine.js';
import { validateGame } from '../src/validation.js';
import { Rooms } from '../backend/rooms.mjs';
import { piece } from '../src/ui/pieces.js';
const sequence = values => { let i=0; return () => values[i++] ?? .5; };
function placements(n, prefix=[]) {
  if(n<2) return [prefix];
  return Array.from({length:n},(_,j)=>placements(n-1,[...prefix,(j+.25)/n])).flat();
}
const side = (p,size) => p.home.y === 0 ? 0 : p.home.x === size-1 ? 1 : p.home.y === size-1 ? 2 : 3;
test('all multiplayer seating permutations and starters are reachable, with clockwise rounds and fair starting gold', () => {
  for(const count of [2,4]) {
    const combinations=new Set();
    for(const draws of placements(count)) for(let starter=0;starter<count;starter++) {
      const g=createGame(sequence([...draws,(starter+.25)/count]),'local',{playerCount:count});
      assert.equal(g.active,starter); assert.equal(g.turnOrder[0],starter);
      combinations.add(g.players.map(p=>side(p,g.boardSize)).join('')+':'+starter);
      assert.equal(new Set(g.players.map(p=>`${p.home.x},${p.home.y}`)).size,count);
      for(let i=0;i<count;i++) assert.equal(g.players[i].resources.gold,g.startingResources.gold+(i===starter?0:1));
      assert.doesNotThrow(()=>validateGame(JSON.parse(JSON.stringify(g))));
      const order=playerOrder(g);
      if(count===4) for(let i=0;i<count;i++) assert.equal(side(g.players[order[(i+1)%count]],13),(side(g.players[order[i]],13)+1)%4);
      for(let i=0;i<count;i++) { assert.equal(g.active,order[i]); assert.equal(g.round,1); endTurn(g); }
      assert.equal(g.active,starter); assert.equal(g.round,2);
      const final = structuredClone(g); final.round=final.turnLimit;
      for(let i=0;i<count;i++) endTurn(final);
      assert.equal(final.finished,true); assert.equal(final.active,order.at(-1));
    }
    assert.equal(combinations.size,count===4?96:4);
  }
});
test('random start survives reverse setup, elimination of the first player and reload', () => {
  const g=createGame(()=>.8,'local',{playerCount:4,openingTilesPerPlayer:1});
  const order=[...g.turnOrder]; assert.equal(order[0],3); startOpening(g);
  const draft=[];
  while(g.opening) {
    draft.push(g.active); let placement;
    for(let i=0;i<g.opening.tiles.length && !placement;i++) for(let r=0;r<4 && !placement;r++) for(let y=0;y<13 && !placement;y++) for(let x=0;x<13 && !placement;x++) if(!openingError(g,i,x,y,r)) placement=[i,x,y,r];
    assert.ok(placement); placeOpeningTile(g,...placement);
  }
  assert.deepEqual(draft,[...order].reverse()); assert.equal(g.active,order[0]);
  eliminatePlayer(g,order[0]); endTurn(g);
  assert.equal(g.active,order[1]); assert.equal(g.round,1);
  const resumed=validateGame(JSON.parse(JSON.stringify(g)));
  endTurn(resumed); endTurn(resumed); endTurn(resumed);
  assert.equal(resumed.active,order[1]); assert.equal(resumed.round,2);
});
test('online players keep their authenticated identities while turns follow the random seat order', () => {
  for(const count of [2,4]) {
    const rooms=new Rooms({gameFactory:(_,mode,settings)=>createGame(()=>.8,mode,settings)});
    const host=rooms.create({playerCount:count},'Host'), clients=[host];
    for(let i=1;i<count;i++) clients.push(rooms.join(host.code,'Guest '+i));
    let state=rooms.read(host.code,host.token);
    state=rooms.lobby(host.code,host.token,{revision:state.revision,start:true});
    assert.equal(state.game.active,count-1);
    assert.deepEqual(state.game.players.map(p=>p.name),['Host',...Array.from({length:count-1},(_,i)=>'Guest '+(i+1))]);
    assert.throws(()=>rooms.command(host.code,host.token,{id:'wrong',revision:state.revision,command:{type:'endTurn',args:[]}}),/turn/);
    for(const owner of state.game.turnOrder) state=rooms.command(host.code,clients[owner].token,{id:'turn-'+owner,revision:state.revision,command:{type:'endTurn',args:[]}});
    assert.equal(state.game.round,2); assert.equal(state.game.active,count-1);
    const room=rooms.rooms.get(host.code);room.settings.turnSeconds=30;room.deadline=Date.now()-1;
    const expected=nextPlayer(room.game);
    state=rooms.read(host.code,host.token); assert.equal(state.game.active,expected);
  }
});
test('Sapphire and Ruby use separate worker and soldier SVG textures', () => {
  for(const [owner,color,fill] of [[2,'sapphire','#5794d2'],[3,'ruby','#c65a70']]) for(const kind of ['worker','soldier']) {
    const filename=`assets/textures/units/${kind}-${color}.svg`;
    assert.ok(piece(kind,owner).includes(filename));
    const svg=readFileSync(new URL('../'+filename,import.meta.url),'utf8');
    assert.ok(svg.includes(fill)); assert.ok(svg.includes('#775b3c'));
    assert.ok(!svg.includes('#e9a948'));
  }
});
