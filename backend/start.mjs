import { createServer } from './server.mjs';
import { Rooms } from './rooms.mjs';
const port = Number(process.env.PORT || 3001);
const origins = (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:4173,http://localhost:4173').split(',').map(s => s.trim());
const options = {
  maxRooms: Number(process.env.MAX_ROOMS || 200),
  ttlMs: Number(process.env.ROOM_TTL_HOURS || 6) * 3600000,
};
let rooms;
if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const { PostgresRooms } = await import('./postgres-rooms.mjs');
  rooms = new PostgresRooms(new pg.Pool({ connectionString: process.env.DATABASE_URL,
    max: 5, connectionTimeoutMillis: 10000, statement_timeout: 15000 }), options);
  await rooms.initialize();
  console.log('Storage: PostgreSQL');
} else {
  rooms = new Rooms(options);
  console.log('Storage: memory (rooms are lost on restart)');
}
const server = createServer({ origins, rooms });
server.listen(port, '0.0.0.0', () => console.log(`KingBuilder multiplayer listening on ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await rooms.close?.(); process.exit(0); }));
