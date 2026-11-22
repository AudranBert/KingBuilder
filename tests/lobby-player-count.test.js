import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../backend/rooms.mjs';
test('host can resize an unstarted lobby without changing existing identities or invitation', () => {
  const rooms=new Rooms(),host=rooms.create({}),guest=rooms.join(host.code,'Guest');
  let state=rooms.read(host.code,host.token);
  state=rooms.lobby(host.code,host.token,{revision:state.revision,settings:{...state.settings,playerCount:4,boardSize:13,mapId:'four_kings'}});
  assert.equal(state.code,host.code);assert.equal(state.joined,false);assert.deepEqual(state.seats,[true,true,false,false]);
  assert.equal(rooms.read(host.code,guest.token).player,1);
  assert.throws(()=>rooms.lobby(host.code,host.token,{revision:state.revision,start:true}));
  state=rooms.lobby(host.code,host.token,{revision:state.revision,settings:{...state.settings,playerCount:2,boardSize:11,mapId:'base'}});
  assert.equal(state.game.players.length,2);assert.equal(state.joined,true);
  state=rooms.lobby(host.code,host.token,{revision:state.revision,settings:{...state.settings,playerCount:4,boardSize:13,mapId:'four_kings'}});
  const third=rooms.join(host.code,'Third');state=rooms.read(host.code,host.token);
  assert.throws(()=>rooms.lobby(host.code,host.token,{revision:state.revision,settings:{...state.settings,playerCount:2,boardSize:11,mapId:'base'}}));
  assert.equal(rooms.read(host.code,third.token).player,2);
  rooms.join(host.code,'Fourth');state=rooms.read(host.code,host.token);
  state=rooms.lobby(host.code,host.token,{revision:state.revision,start:true});assert.equal(state.started,true);assert.equal(state.game.players.length,4);
});
