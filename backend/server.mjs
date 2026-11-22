import { ruleIssue } from "../src/rule-errors.js";
import http from 'node:http';
import { Rooms, RoomError } from './rooms.mjs';

export function createServer({ rooms = new Rooms(), origins = [], rateLimit = 300 } = {}) {
  const requests = new Map();
  return http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    try {
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) throw new RoomError(403, ruleIssue("messages.originRejected"));
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') return reply(204, null);
      const now = Date.now(), ip = req.socket.remoteAddress;
      for (const [key, value] of requests) if (now - value.start > 60000) requests.delete(key);
      const rate = requests.get(ip) || { start: now, count: 0 };
      requests.set(ip, rate);
      if (++rate.count > rateLimit) throw new RoomError(429, ruleIssue("messages.tooManyRequestsTryAgainInA"));
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') return reply(200, { status: 'ok' });
      if (req.method === 'GET' && url.pathname === '/history') return reply(200, rooms.history ? await rooms.history() : { enabled: false, games: [] });
      const match = url.pathname.match(/^\/rooms(?:\/([A-Fa-f0-9]{10})(?:\/(join|commands|lobby|resign|profile))?)?$/);
      if (!match) throw new RoomError(404, ruleIssue("messages.unknownRoute"));
      let body = {};
      if (req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) throw new RoomError(413, ruleIssue("messages.requestTooLarge")); }
        try { body = JSON.parse(raw || '{}'); } catch { throw new RoomError(400, ruleIssue("messages.invalidJSON")); }
      }
      const [, code, operation] = match, token = req.headers.authorization?.replace(/^Bearer /, '');
      if (req.method === 'POST' && operation === 'profile') return reply(200, await rooms.profile(code, token, body));
      if (req.method === 'POST' && operation === 'resign') return reply(200, await rooms.resign(code, token));
      if (req.method === 'POST' && operation === 'lobby') return reply(200, await rooms.lobby(code, token, body));
      if (req.method === 'POST' && !code) return reply(201, await rooms.create(body.settings, body.nickname));
      if (req.method === 'POST' && operation === 'join') return reply(200, await rooms.join(code, body.nickname));
      if (req.method === 'POST' && operation === 'commands') return reply(200, await rooms.command(code, token, body));
      if (req.method === 'GET' && code && !operation) return reply(200, await rooms.read(code, token));
      throw new RoomError(405, ruleIssue("messages.methodRejected"));
    } catch (error) {
      const databaseError = !error.issue && (error.code || error.name === 'AggregateError');
      if (databaseError) console.error('Storage operation failed', error.code || error.name);
      reply(error.status || (databaseError ? 503 : 400), { error: databaseError ? 'Stockage temporairement indisponible. Réessayez.' : error.message, ...(error.issue ? { issue: error.issue } : {}) });
    }
  });
}
