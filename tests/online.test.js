import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../backend/rooms.mjs';
import { createServer } from '../backend/server.mjs';
import { GAME_DEFAULTS } from '../src/engine.js';

const settings = { ...GAME_DEFAULTS, openingTilesPerPlayer: 0 };
test('pseudos : chaque joueur choisit son nom, défaut par couleur et conservation au lancement', () => {
  const rooms = new Rooms(), host = rooms.create(settings), guest = rooms.join(host.code);
  assert.equal(host.game.players[0].name, 'Amber');
  assert.equal(guest.game.players[1].name, 'Jade');
  rooms.profile(host.code, guest.token, { nickname: '  Alice  ' });
  rooms.profile(host.code, host.token, { nickname: 'Bob' });
  const started = rooms.lobby(host.code, host.token, { revision: 2, start: true });
  assert.deepEqual(started.game.players.map(p => p.name), ['Bob', 'Alice']);
  assert.throws(() => rooms.profile(host.code, guest.token, { nickname: 'Autre' }), /started/);
});
test('chronomètre : expiration autoritaire et abandon hors de son tour', () => {
  const rooms = new Rooms(), host = rooms.create(settings), guest = rooms.join(host.code);
  assert.throws(() => rooms.lobby(host.code, host.token, { revision: 0, settings: { ...settings, turnSeconds: 10 } }), /time limit/);
  rooms.lobby(host.code, host.token, { revision: 0, settings: { ...settings, turnSeconds: 30 }, start: true });
  const room = rooms.rooms.get(host.code);
  assert.ok(room.deadline);
  room.deadline = Date.now() - 1;
  const state = rooms.read(host.code, guest.token);
  assert.equal(state.game.active, 1);
  assert.equal(state.revision, 2);
  assert.ok(state.deadline > Date.now());
  const ended = rooms.resign(host.code, host.token);
  assert.equal(ended.game.finished, true);
  assert.equal(ended.game.winner, 1);
  assert.equal(ended.game.victory, 'resignation');
  assert.equal(ended.deadline, null);
  assert.equal(rooms.resign(host.code, guest.token).game.winner, 1);
});
test('lobby : réglages réservés à l’hôte et lancement explicite à deux', () => {
  const rooms = new Rooms(), host = rooms.create(settings);
  assert.equal(host.started, false);
  assert.throws(() => rooms.lobby(host.code, host.token, { revision: 0, start: true }), /second player/);
  const guest = rooms.join(host.code);
  assert.throws(() => rooms.command(host.code, host.token, { id: 'early', revision: 0, command: { type: 'endTurn', args: [] } }), /started/);
  assert.throws(() => rooms.lobby(host.code, guest.token, { revision: 0, settings }), /host/);
  const updated = rooms.lobby(host.code, host.token, { revision: 0, settings: { ...settings, rounds: 30 } });
  assert.equal(updated.started, false);
  assert.equal(rooms.read(host.code, guest.token).settings.rounds, 30);
  assert.equal(rooms.lobby(host.code, host.token, { revision: 1, start: true }).started, true);
  assert.throws(() => rooms.lobby(host.code, host.token, { revision: 2, settings }), /already/);
});

test('missions : le choix de l’hôte est partagé et appliqué au lancement en ligne', () => {
  const rooms = new Rooms(), noMissions = { ...settings, missionsEnabled: false };
  const host = rooms.create(noMissions), guest = rooms.join(host.code);
  assert.equal(guest.settings.missionsEnabled, false);
  assert.deepEqual(guest.game.missions.market, []);
  const updated = rooms.lobby(host.code, host.token, { revision: 0, settings: { ...settings, missionsEnabled: true } });
  assert.equal(updated.game.missionsEnabled, true);
  assert.ok(updated.game.missions.market.length > 0);
  assert.equal(rooms.read(host.code, guest.token).settings.missionsEnabled, true);
  assert.throws(() => rooms.lobby(host.code, guest.token, { revision: 1, settings: noMissions }), /host/);
  const started = rooms.lobby(host.code, host.token, { revision: 1, settings: noMissions, start: true });
  assert.equal(started.game.missionsEnabled, false);
  assert.deepEqual(started.game.missions.market, []);
});
test('cartes : le choix de l’hôte et le plateau sont partagés en ligne', () => {
  const rooms = new Rooms(), host = rooms.create(settings), guest = rooms.join(host.code);
  const updated = rooms.lobby(host.code, host.token, {
    revision: 0, settings: { ...settings, mapId: 'valley' },
  });
  assert.equal(updated.game.mapId, 'valley');
  assert.equal(updated.game.opening, null);
  const shared = rooms.read(host.code, guest.token);
  assert.equal(shared.settings.mapId, 'valley');
  assert.deepEqual(shared.game.board, updated.game.board);
  const started = rooms.lobby(host.code, host.token, { revision: 1, start: true });
  assert.equal(started.game.mapId, 'valley');
  assert.deepEqual(started.game.board, updated.game.board);
  assert.deepEqual(rooms.read(host.code, guest.token).game.board, started.game.board);
});

test('salon privé : authentification, tours, commandes atomiques et dédoublonnage', () => {
  const rooms = new Rooms(), host = rooms.create(settings), guest = rooms.join(host.code);
  assert.equal(host.player, 0); assert.equal(guest.player, 1);
  assert.throws(() => rooms.join(host.code), /full/);
  assert.throws(() => rooms.read(host.code, 'fake'), /denied/);
  assert.equal(host.game.tileDeck.length, 0);
  rooms.rooms.get(host.code).started = true;
  const request = { id: 'one', revision: 0, command: { type: 'endTurn', args: [] } };
  assert.throws(() => rooms.command(host.code, guest.token, request), /turn/);
  const next = rooms.command(host.code, host.token, request);
  assert.equal(next.game.active, 1); assert.equal(next.revision, 1);
  assert.equal(rooms.command(host.code, host.token, request).revision, 1);
  assert.throws(() => rooms.command(host.code, guest.token, { ...request, id: 'stale' }), /changed/);
  assert.throws(() => rooms.command(host.code, guest.token, { id: 'bad', revision: 1, command: { type: 'build', args: [999, 0, 0] } }));
  assert.equal(rooms.read(host.code, guest.token).revision, 1);
});
test('salons : expiration et capacité bornée', () => {
  const rooms = new Rooms({ maxRooms: 1 });
  const host = rooms.create(settings);
  assert.throws(() => rooms.create(settings), /full/);
  rooms.rooms.get(host.code).updatedAt = 0;
  assert.throws(() => rooms.read(host.code, host.token), /expired/);
  assert.ok(rooms.create(settings));
});
test('API HTTP : création, invitation, reprise, validation et CORS', async t => {
  const server = createServer({ origins: ['https://example.test'] });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, token) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const host = await (await post('/rooms', { settings })).json();
  const guest = await (await post(`/rooms/${host.code}/join`, {})).json();
  assert.equal(guest.joined, true);
  const started = await post(`/rooms/${host.code}/lobby`, { revision: 0, start: true }, host.token);
  assert.equal(started.status, 200);
  const move = await post(`/rooms/${host.code}/commands`, { id: 'turn', revision: 1, command: { type: 'endTurn', args: [] } }, host.token);
  assert.equal(move.status, 200);
  const restored = await (await fetch(`${url}/rooms/${host.code}`, { headers: { Authorization: `Bearer ${guest.token}` } })).json();
  assert.equal(restored.revision, 2); assert.equal(restored.game.active, 1);
  assert.equal((await fetch(url + '/health', { headers: { Origin: 'https://evil.test' } })).status, 403);
  assert.equal((await fetch(url + '/health', { headers: { Origin: 'https://example.test' } })).headers.get('access-control-allow-origin'), 'https://example.test');
});
