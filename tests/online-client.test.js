import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineClient, savedSession } from '../src/online.js';
import { Rooms } from '../backend/rooms.mjs';
import { GAME_DEFAULTS } from '../src/engine.js';

function mount(t) {
  const memory = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), clear: () => values.clear() };
  };
  for (const name of ['localStorage', 'sessionStorage']) {
    const before = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: memory() });
    t.after(() => before ? Object.defineProperty(globalThis, name, before) : delete globalThis[name]);
  }
  t.mock.method(globalThis, 'setTimeout', () => 0);
  const rooms = new Rooms();
  const host = rooms.create({ ...GAME_DEFAULTS, openingTilesPerPlayer: 0 });
  class Client extends OnlineClient {
    async configure() { this.url = 'https://game.example'; }
    async request(path, body, token = this.session?.token) {
      if (path.endsWith('/resign')) return rooms.resign(host.code, token);
      return rooms.read(host.code, token);
    }
  }
  const client = new Client(() => {}, () => {});
  client.url = 'https://game.example';
  return { client, host, rooms, fresh: () => new Client(() => {}, () => {}) };
}

test('reprise : aucun accès sauvegardé, JSON invalide ou partie expirée désactivent la reprise', async t => {
  const { client, host, rooms } = mount(t);
  assert.equal(await client.canResume(), false);
  localStorage.setItem('kingbuilder-online', '{bad json');
  assert.equal(await client.canResume(), false);
  client.accept(host);
  rooms.rooms.clear();
  await assert.rejects(client.canResume(), error => error.status === 404);
  assert.equal(savedSession(), null);
});

test('reprise : une fermeture d’onglet conserve la partie inachevée et une coupure réseau ne l’efface pas', async t => {
  const { client, host, fresh } = mount(t);
  client.accept(host);
  client.stop();
  sessionStorage.clear();
  const reopened = fresh();
  assert.equal(await reopened.canResume(), true);
  await reopened.resume();
  assert.equal(reopened.session.code, host.code);
  reopened.request = async () => { throw Error('offline'); };
  await assert.rejects(reopened.canResume(), /offline/);
  assert.ok(savedSession());
  reopened.stop();
});

test('reprise : une partie terminée ou abandonnée ne peut plus être reprise', async t => {
  const { client, host, rooms } = mount(t);
  client.accept(host);
  rooms.join(host.code);
  const started = rooms.lobby(host.code, host.token, { revision: 0, start: true });
  client.accept(started);
  await client.resign();
  assert.equal(savedSession(), null);
  assert.equal(await client.canResume(), false);
  client.accept(host); // A stale local entry must also be rejected by server verification.
  assert.equal(await client.canResume(), false);
  assert.equal(savedSession(), null);
  await assert.rejects(client.resume(), /inachevée/);
});

test('reprise : terminer une partie dans un onglet ne supprime pas celle d’un autre onglet', t => {
  const { client, host, rooms } = mount(t);
  client.accept(host);
  const other = rooms.create({ ...GAME_DEFAULTS, openingTilesPerPlayer: 0 });
  localStorage.setItem('kingbuilder-online', JSON.stringify({ code: other.code, token: other.token, url: 'https://game.example' }));
  assert.equal(savedSession().code, host.code, 'the current tab keeps its own session');
  rooms.get(host.code).game.finished = true;
  client.accept(rooms.read(host.code, host.token));
  assert.equal(savedSession().code, other.code);
});
