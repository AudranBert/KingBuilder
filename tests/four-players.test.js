import { createFixedGame as createGame } from "./helpers.js";
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOpening, openingError, placeOpeningTile, endTurn, movementPaths, attackPaths, attack, pawns } from "../src/engine.js";
import { validateGame } from '../src/validation.js';
import { Rooms as RandomRooms } from '../backend/rooms.mjs';
class Rooms extends RandomRooms { constructor(options) { super({ ...options, gameFactory: createGame }); } }
import { mapCells, MAPS } from '../src/maps.js';
import { playersView, rulesView, catalogueView } from '../src/ui/views.js';
const settings = { playerCount: 4 };
test('4 kings: custom map, four side starts, identities and complete rounds', () => {
  const game = createGame(() => .5, 'local', settings);
  assert.equal(game.boardSize, 13); assert.equal(game.mapId, 'four_kings');
  assert.deepEqual(game.players.map(p => [p.x,p.y]), [[0,6],[6,0],[12,6],[6,12]]);
  const cells = mapCells(MAPS.find(m => m.id === 'four_kings'), 13);
  assert.equal([...cells.values()].filter(c => c.flag).length, 5);
  for (const [position, cell] of cells) assert.deepEqual(game.board[position], cell);
  assert.doesNotThrow(() => validateGame(game));
  assert.match(playersView(game), /sapphire/); assert.match(playersView(game), /ruby/);
  assert.match(rulesView(game), /limin/); assert.match(catalogueView(), /4 kings/);
  for (const active of [1,2,3,0]) { endTurn(game); assert.equal(game.active, active); }
  assert.equal(game.round, 2);
  while (!game.finished) endTurn(game);
  assert.equal(game.round, 25); assert.equal(game.active, 3);
});
test('four-player opening visits every player in reverse order and restores round one', () => {
  const game = createGame(() => .5, 'local', {...settings, openingTilesPerPlayer: 2}); startOpening(game);
  const order = [];
  while (game.opening) {
    order.push(game.active); let chosen;
    for(let i=0;i<game.opening.tiles.length && !chosen;i++) for(let r=0;r<4 && !chosen;r++) for(let y=0;y<13 && !chosen;y++) for(let x=0;x<13 && !chosen;x++)
      if (!openingError(game,i,x,y,r)) chosen=[i,x,y,r];
    assert.ok(chosen); placeOpeningTile(game,...chosen);
  }
  assert.deepEqual(order,[3,2,1,0,3,2,1,0]); assert.equal(game.active,0); assert.equal(game.round,1);
});
test('all three opponents block movement and are valid combat targets', () => {
  for(const opponent of [1,2,3]) {
    const game=createGame(()=>.5,'local',settings), p=game.players[0];
    Object.assign(p.units[0],{x:5,y:6,type:'soldier',moves:3}); game.selectedUnitId=0;
    game.board['5,6']={terrain:'plain'}; game.board['6,6']={terrain:'plain'};
    Object.assign(game.players[opponent].units[0],{x:6,y:6});
    assert.equal(movementPaths(game).has('6,6'),false); assert.equal(attackPaths(game).has('6,6'),true);
    attack(game,6,6); assert.equal(p.units[0].x,6);
  }
});
test('castle conquest eliminates only its kingdom and skips its subsequent turns', () => {
  const game=createGame(()=>.5,'local',settings), victim=game.players[2], target=game.board['12,6'].building;
  game.players[0].units = Array.from({length:12},(_,id)=>({id,type:'soldier',x:11,y:6,moves:3,acted:false,ended:false,skipTurns:0}));
  game.players[0].workers=0; game.players[0].nextUnitId=12; game.selectedUnitId=0; game.board['11,6']={terrain:'plain'};
  attack(game,12,6); assert.equal(victim.eliminated,true); assert.equal(pawns(game,2).length,0); assert.equal(game.finished,false); assert.equal(target.owner,0);
  endTurn(game); assert.equal(game.active,1); endTurn(game); assert.equal(game.active,3);
  assert.doesNotThrow(()=>validateGame(game));
});
test('online: four seats, no early launch, authenticated rotation, resume and individual resignations', () => {
  const rooms=new Rooms(), host=rooms.create(settings,'Host');
  assert.equal(host.game.players.length,4); assert.equal(host.game.boardSize,13);
  assert.throws(()=>rooms.lobby(host.code,host.token,{revision:0,start:true}));
  const clients=[host];
  for(let i=1;i<4;i++) { const guest=rooms.join(host.code,`P${i}`); assert.equal(guest.player,i); clients.push(guest); }
  assert.throws(()=>rooms.join(host.code));
  let state=rooms.read(host.code,host.token); assert.deepEqual(state.seats,[true,true,true,true]);
  state=rooms.lobby(host.code,host.token,{revision:state.revision,start:true});
  for(let i=0;i<4;i++) { state=rooms.command(host.code,clients[i].token,{id:`turn${i}`,revision:state.revision,command:{type:'endTurn',args:[]}}); }
  assert.equal(state.game.round,2); assert.equal(state.game.active,0);
  const revision=state.revision;
  state=rooms.resign(host.code,clients[2].token); assert.equal(state.game.finished,false); assert.equal(state.game.active,0);
  assert.equal(rooms.read(host.code,clients[3].token).game.players[2].eliminated,true);
  state=rooms.resign(host.code,host.token); assert.equal(state.game.active,1);
  state=rooms.resign(host.code,clients[1].token); assert.equal(state.game.finished,true); assert.equal(state.game.winner,3);
  assert.ok(state.revision>revision); assert.doesNotThrow(()=>validateGame(state.game));
});

test('online: resignation during opening removes future picks without blocking setup', () => {
  const rooms = new Rooms(), host = rooms.create({playerCount:4,openingTilesPerPlayer:2});
  const clients=[host]; for(let i=1;i<4;i++) clients.push(rooms.join(host.code));
  let state=rooms.read(host.code,host.token);
  state=rooms.lobby(host.code,host.token,{revision:state.revision,start:true});
  state=rooms.resign(host.code,clients[3].token);
  assert.equal(state.game.active,2); assert.equal(state.game.opening.totalPlacements,6);
  const room=rooms.rooms.get(host.code);
  while(room.game.opening) {
    const game=room.game; let chosen;
    for(let i=0;i<game.opening.tiles.length && !chosen;i++) for(let r=0;r<4 && !chosen;r++) for(let y=0;y<13 && !chosen;y++) for(let x=0;x<13 && !chosen;x++)
      if(!openingError(game,i,x,y,r)) chosen=[i,x,y,r];
    assert.ok(chosen);
    rooms.command(host.code,clients[game.active].token,{id:'pick'+game.opening.step,revision:room.revision,command:{type:'placeOpeningTile',args:chosen}});
  }
  assert.equal(room.game.active,0); assert.equal(room.game.round,1);
  assert.deepEqual(room.game.players.map(p=>p.name),['Amber','Jade','Sapphire','Ruby']);
});
