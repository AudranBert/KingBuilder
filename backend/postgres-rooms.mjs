import { ruleIssue } from "../src/rule-errors.js";
import { Rooms, RoomError } from './rooms.mjs';
import { totalScore } from '../src/engine.js';

// Each operation loads a room into the existing rules service. Row locks make
// validation + mutation + persistence atomic, including across server instances.
export class PostgresRooms {
  constructor(pool, options = {}) { this.pool = pool; this.options = options; }
  async initialize() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS kingbuilder_rooms (
      code text PRIMARY KEY,
      payload jsonb NOT NULL,
      expires_at timestamptz NOT NULL
    )`);
    await this.pool.query('CREATE INDEX IF NOT EXISTS kingbuilder_rooms_expiry ON kingbuilder_rooms (expires_at)');
    await this.pool.query(`CREATE TABLE IF NOT EXISTS kingbuilder_history (
      code text PRIMARY KEY, finished_at timestamptz NOT NULL DEFAULT now(), summary jsonb NOT NULL
    )`);
    await this.pool.query('CREATE INDEX IF NOT EXISTS kingbuilder_history_date ON kingbuilder_history (finished_at DESC)');
  }
  async execute(operation, code, ...args) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const rooms = new Rooms(this.options);
      if (operation === 'create') {
        // Serialize capacity checks and creation without locking unrelated moves.
        await client.query('SELECT pg_advisory_xact_lock(7429031)');
        await client.query('DELETE FROM kingbuilder_rooms WHERE expires_at <= now()');
        const count = await client.query('SELECT count(*)::integer AS count FROM kingbuilder_rooms');
        if (count.rows[0].count >= rooms.maxRooms) throw new RoomError(503, ruleIssue("messages.serverFullTryAgainLater"));
      } else {
        const result = await client.query('SELECT payload FROM kingbuilder_rooms WHERE code = $1 AND expires_at > now() FOR UPDATE', [code.toUpperCase()]);
        if (!result.rows.length) throw new RoomError(404, ruleIssue("messages.gameNotFoundOrExpired"));
        const room = result.rows[0].payload;
        room.receipts = new Map(room.receipts);
        rooms.rooms.set(room.code, room);
      }
      const result = operation === 'create' ? rooms.create(...args) : rooms[operation](code, ...args);
      {
        const room = rooms.rooms.get(result.code);
        const payload = { ...room, receipts: [...room.receipts] };
        await client.query(`INSERT INTO kingbuilder_rooms (code, payload, expires_at) VALUES ($1, $2, $3)
          ON CONFLICT (code) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`,
        [room.code, JSON.stringify(payload), new Date(room.updatedAt + rooms.ttlMs)]);
        if (room.game.finished) {
          const scores = room.game.players.map((_, i) => totalScore(room.game, i));
          const leaders = scores.map((n, i) => !room.game.players[i].eliminated ? i : -1).filter(i => i >= 0);
          const best = Math.max(...leaders.map(i => scores[i]));
          const tied = leaders.filter(i => scores[i] === best);
          const winner = room.game.winner ?? (tied.length === 1 ? tied[0] : null);
          await client.query('INSERT INTO kingbuilder_history (code, summary) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
            [room.code, JSON.stringify({ names: room.game.players.map(p => p.name), scores, winner })]);
        }
      }
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  create(settings, nickname) { return this.execute('create', null, settings, nickname); }
  join(code, nickname) { return this.execute('join', code, nickname); }
  lobby(code, token, request) { return this.execute('lobby', code, token, request); }
  resign(code, token) { return this.execute('resign', code, token); }
  profile(code, token, request) { return this.execute('profile', code, token, request); }
  read(code, token) { return this.execute('read', code, token); }
  command(code, token, request) { return this.execute('command', code, token, request); }
  async close() { await this.pool.end(); }
  async history() {
    const result = await this.pool.query('SELECT summary, finished_at FROM kingbuilder_history ORDER BY finished_at DESC LIMIT 30');
    return { enabled: true, games: result.rows.map(row => ({ ...row.summary, finishedAt: row.finished_at })) };
  }
}
