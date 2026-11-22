import { Readable } from 'node:stream';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rooms as RandomRooms } from '../backend/rooms.mjs';
import { createFixedGame } from './helpers.js';
class Rooms extends RandomRooms { constructor(options) { super({ ...options, gameFactory: createFixedGame }); } }
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
// Exercise the real HTTP request listener without needing a TCP port.
function request(server, url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise(resolve => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
    Object.assign(req, { url, method, socket: { remoteAddress: '127.0.0.1' },
      headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])) });
    const responseHeaders = new Headers();
    const res = {
      statusCode: 200,
      setHeader(key, value) { responseHeaders.set(key, value); },
      writeHead(status) { this.statusCode = status; return this; },
      end(value) { resolve(new Response(this.statusCode === 204 ? null : value, { status: this.statusCode, headers: responseHeaders })); },
    };
    server.emit('request', req, res);
  });
}

test('API HTTP : création, invitation, reprise, validation et CORS', async () => {
  const server = createServer({ rooms: new Rooms(), origins: ['https://example.test'] });
  const post = (path, body, token) => request(server, path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const host = await (await post('/rooms', { settings })).json();
  const guest = await (await post(`/rooms/${host.code}/join`, {})).json();
  assert.equal(guest.joined, true);
  const started = await post(`/rooms/${host.code}/lobby`, { revision: 0, start: true }, host.token);
  assert.equal(started.status, 200);
  const move = await post(`/rooms/${host.code}/commands`, { id: 'turn', revision: 1, command: { type: 'endTurn', args: [] } }, host.token);
  assert.equal(move.status, 200);
  const restored = await (await request(server, `/rooms/${host.code}`, { headers: { Authorization: `Bearer ${guest.token}` } })).json();
  assert.equal(restored.revision, 2); assert.equal(restored.game.active, 1);
  assert.equal((await request(server, '/health', { headers: { Origin: 'https://evil.test' } })).status, 403);
  assert.equal((await request(server, '/health', { headers: { Origin: 'https://example.test' } })).headers.get('access-control-allow-origin'), 'https://example.test');
});

// Keep a transport smoke test as well; restricted runners can still run the API tests above.
test('HTTP transport : health endpoint over TCP', async t => {
  const server = createServer();
  t.after(() => { server.closeAllConnections(); server.close(); });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', supportedPlayerCounts: [2, 4] });
  } catch (error) {
    if (['EACCES', 'EPERM'].includes(error.code ?? error.cause?.code)) {
      t.skip('This runner blocks local TCP connections; API request handling is tested in-process.');
    } else throw error;
  }
});


test('all room responses hide mission decks without mutating the authoritative deck', () => {
  const rooms = new Rooms(), host = rooms.create(settings), guest = rooms.join(host.code);
  const assertHidden = state => {
    assert.deepEqual(state.game.tileDeck, []);
    assert.deepEqual(state.game.buildingDeck, []);
    assert.deepEqual(state.game.missions.deck, []);
    assert.ok(state.game.missions.market.length > 0);
  };
  assertHidden(host); assertHidden(guest);
  const deck = structuredClone(rooms.rooms.get(host.code).game.missions.deck);
  assert.ok(deck.length > 0);
  assertHidden(rooms.read(host.code, guest.token));
  assertHidden(rooms.profile(host.code, host.token, { nickname: 'Alice' }));
  assert.deepEqual(rooms.rooms.get(host.code).game.missions.deck, deck);
  assertHidden(rooms.lobby(host.code, host.token, { revision: 1 }));
  assertHidden(rooms.lobby(host.code, host.token, { revision: 2, start: true }));
  const room = rooms.rooms.get(host.code);
  const next = room.game.missions.deck.find(id => id === 'build-4');
  assert.ok(next);
  // Completing a mission must still reveal the next offer from the private deck.
  room.game.missions.market = ['build-2'];
  room.game.missions.deck = [next];
  room.game.missions.baselines = { 'build-2': [0, 0] };
  room.game.players[0].progress.built.farm = 3;
  const state = rooms.command(host.code, host.token, { id: 'claim', revision: 3, command: { type: 'endTurn', args: [] } });
  assertHidden(state);
  assert.deepEqual(state.game.missions.market, [next]);
  assert.equal(room.game.missions.claimed[0].id, 'build-2');
  assertHidden(rooms.resign(host.code, guest.token));
});

test('HTTP rule errors retain their codes and details instead of becoming storage failures', async () => {
  const rooms = new Rooms(), server = createServer({ rooms });
  const host = rooms.create(settings); rooms.join(host.code);
  rooms.lobby(host.code, host.token, { revision: 0, start: true });
  const game = rooms.rooms.get(host.code).game;
  game.buildingMarket = ['outpost'];
  game.board['1,6'] = { terrain: 'river' };
  const response = await request(server, '/rooms/' + host.code + '/commands', {
    method: 'POST', headers: { Authorization: 'Bearer ' + host.token },
    body: JSON.stringify({ id: 'bad-terrain', revision: 1, command: { type: 'build', unit: game.players[0].units[0].id, args: [0,1,6] } }),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.issue.code, 'terrainMismatch');
  assert.deepEqual(body.issue.required, ['plain','forest']);
  assert.equal(body.issue.actual, 'river');
  assert.equal(rooms.rooms.get(host.code).revision, 1);
});
