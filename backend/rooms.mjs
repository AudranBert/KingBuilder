import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { createGame, startOpening, rerollError, GAME_DEFAULTS, endTurn } from '../src/engine.js';
import { applyCommand } from '../src/commands.js';

export class RoomError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export class Rooms {
  setDeadline(room, now = Date.now()) {
    room.deadline = room.started && !room.game.opening && !room.game.finished && room.settings?.turnSeconds
      ? now + room.settings.turnSeconds * 1000 : null;
  }
  advanceClock(room) {
    const now = Date.now();
    while (room.deadline && now >= room.deadline && !room.game.finished) {
      const previous = room.deadline;
      endTurn(room.game); room.revision++; room.updatedAt = now;
      this.setDeadline(room, previous);
    }
  }
  constructor({ maxRooms = 200, ttlMs = 6 * 3600000 } = {}) {
    this.rooms = new Map(); this.maxRooms = maxRooms; this.ttlMs = ttlMs;
  }
  prune() {
    for (const [code, room] of this.rooms) if (Date.now() - room.updatedAt > this.ttlMs) this.rooms.delete(code);
  }
  create(settings, nickname = '') {
    this.validateNickname(nickname);
    this.prune();
    if (this.rooms.size >= this.maxRooms) throw new RoomError(503, 'Serveur complet. Réessayez plus tard.');
    let code;
    do { code = randomBytes(5).toString('hex').toUpperCase(); } while (this.rooms.has(code));
    const game = createGame(() => randomInt(0x100000000) / 0x100000000, 'local', settings ?? null);
    startOpening(game);
    const room = { code, game, revision: 0, joined: false, tokens: [randomBytes(32).toString('hex'), null], updatedAt: Date.now(), receipts: new Map() };
    this.rooms.set(code, room);
    room.started = false;
    room.nicknames = [nickname.trim(), ''];
    game.players.forEach((p, i) => { p.name = room.nicknames[i] || (i === 0 ? 'Ambre' : 'Jade'); });
    room.settings = structuredClone(settings ?? GAME_DEFAULTS);
    return { ...this.view(room, 0), token: room.tokens[0] };
  }
  get(code) {
    this.prune();
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError(404, 'Partie introuvable ou expirée.');
    this.advanceClock(room);
    return room;
  }
  join(code, nickname = '') {
    this.validateNickname(nickname);
    const room = this.get(code);
    if (room.joined) throw new RoomError(409, 'Cette partie est complète.');
    room.nicknames ??= ['', ''];
    room.nicknames[1] = nickname.trim();
    room.game.players[1].name = nickname.trim() || 'Jade';
    room.tokens[1] = randomBytes(32).toString('hex'); room.joined = true; room.updatedAt = Date.now();
    return { ...this.view(room, 1), token: room.tokens[1] };
  }
  authenticate(room, token) {
    if (typeof token !== 'string') throw new RoomError(401, 'Accès refusé.');
    const player = room.tokens.findIndex(t => t && t.length === token.length && timingSafeEqual(Buffer.from(t), Buffer.from(token)));
    if (player < 0) throw new RoomError(401, 'Accès refusé.');
    return player;
  }
  view(room, player) {
    // Deck order stays on the server; only visible offers are shared.
    const game = structuredClone(room.game);
    game.tileDeck = []; game.buildingDeck = [];
    return { code: room.code, player, joined: room.joined, started: room.started ?? true, settings: room.settings, deadline: room.deadline, serverNow: Date.now(), revision: room.revision, game,
      rerollErrors: { terrain: rerollError(room.game, 'terrain'), building: rerollError(room.game, 'building') } };
  }
  read(code, token) {
    const room = this.get(code), player = this.authenticate(room, token);
    return this.view(room, player);
  }
  command(code, token, request) {
    const room = this.get(code), player = this.authenticate(room, token);
    if (!request || typeof request.id !== 'string' || request.id.length > 100) throw new RoomError(400, 'Identifiant de commande invalide.');
    const receipt = `${player}:${request.id}`;
    if (room.receipts.has(receipt)) return this.view(room, player);
    if (!room.joined) throw new RoomError(409, 'En attente du deuxième joueur.');
    if (room.started === false) throw new RoomError(409, 'La partie n’a pas encore été lancée.');
    if (request.revision !== room.revision) throw new RoomError(409, 'La partie a changé. Réessayez.');
    if (room.game.active !== player) throw new RoomError(403, 'Ce n’est pas votre tour.');
    const previousTurn = `${room.game.round}:${room.game.active}:${Boolean(room.game.opening)}`;
    room.game = applyCommand(room.game, request.command);
    if (previousTurn !== `${room.game.round}:${room.game.active}:${Boolean(room.game.opening)}`) this.setDeadline(room);
    room.revision++; room.updatedAt = Date.now(); room.receipts.set(receipt, true);
    if (room.receipts.size > 100) room.receipts.delete(room.receipts.keys().next().value);
    return this.view(room, player);
  }
  lobby(code, token, request) {
    const room = this.get(code), player = this.authenticate(room, token);
    if (player !== 0) throw new RoomError(403, 'Seul l’hôte peut modifier ou lancer la partie.');
    if (room.started) throw new RoomError(409, 'La partie est déjà lancée.');
    if (request.revision !== room.revision) throw new RoomError(409, 'Le salon a changé. Réessayez.');
    if (request.start && !room.joined) throw new RoomError(409, 'Attendez le deuxième joueur.');
    const settings = request.settings ?? room.settings;
    const seconds = settings.turnSeconds ?? 0;
    if (!Number.isInteger(seconds) || (seconds !== 0 && (seconds < 30 || seconds > 180))) throw new RoomError(400, 'Temps par tour invalide.');
    const game = createGame(() => randomInt(0x100000000) / 0x100000000, 'local', settings);
    startOpening(game);
    game.players.forEach((p, i) => { p.name = room.nicknames?.[i] || (i === 0 ? 'Ambre' : 'Jade'); });
    room.game = game; room.settings = structuredClone(settings);
    room.started = request.start === true; room.revision++; room.updatedAt = Date.now();
    this.setDeadline(room);
    return this.view(room, player);
  }
  resign(code, token) {
    const room = this.get(code), player = this.authenticate(room, token);
    if (!room.started) throw new RoomError(409, 'La partie n’a pas commencé.');
    if (!room.game.finished) {
      room.game.finished = true; room.game.winner = 1 - player; room.game.victory = 'resignation';
      room.deadline = null; room.revision++; room.updatedAt = Date.now();
    }
    return this.view(room, player);
  }
  profile(code, token, request) {
    const room = this.get(code), player = this.authenticate(room, token);
    if (room.started) throw new RoomError(409, 'La partie est déjà lancée.');
    this.validateNickname(request.nickname);
    room.nicknames ??= ['', ''];
    room.nicknames[player] = request.nickname.trim();
    room.game.players[player].name = room.nicknames[player] || (player === 0 ? 'Ambre' : 'Jade');
    room.revision++; room.updatedAt = Date.now();
    return this.view(room, player);
  }
  validateNickname(nickname) {
    if (typeof nickname !== 'string' || nickname.trim().length > 24 || /[\u0000-\u001f\u007f]/.test(nickname)) throw new RoomError(400, 'Pseudo invalide (24 caractères maximum).');
  }
}
