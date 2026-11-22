import { KINGDOMS } from "../src/players.js";
import { ruleIssue, RuleError } from "../src/rule-errors.js";
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { createGame, startOpening, rerollIssue, GAME_DEFAULTS, endTurn, eliminatePlayer, nextPlayer, firstRemainingPlayer } from '../src/engine.js';
import { applyCommand } from '../src/commands.js';

export class RoomError extends RuleError {
  constructor(status, issue) { super(issue); this.status = status; }
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
  constructor({ maxRooms = 200, ttlMs = 6 * 3600000, gameFactory = createGame } = {}) {
    this.gameFactory = gameFactory; this.rooms = new Map(); this.maxRooms = maxRooms; this.ttlMs = ttlMs;
  }
  prune() {
    for (const [code, room] of this.rooms) if (Date.now() - room.updatedAt > this.ttlMs) this.rooms.delete(code);
  }
  create(settings, nickname = '') {
    this.validateNickname(nickname);
    this.prune();
    if (this.rooms.size >= this.maxRooms) throw new RoomError(503, ruleIssue("messages.serverFullTryAgainLater"));
    let code;
    do { code = randomBytes(5).toString('hex').toUpperCase(); } while (this.rooms.has(code));
    const game = this.gameFactory(() => randomInt(0x100000000) / 0x100000000, 'local', settings ?? null);
    startOpening(game);
    const room = { code, game, revision: 0, joined: false, tokens: game.players.map((_, i) => i === 0 ? randomBytes(32).toString('hex') : null), updatedAt: Date.now(), receipts: new Map() };
    this.rooms.set(code, room);
    room.started = false;
    room.nicknames = game.players.map((_, i) => i === 0 ? nickname.trim() : '');
    game.players.forEach((p, i) => { p.name = room.nicknames[i] || KINGDOMS[i].nickname; });
    room.settings = structuredClone(settings ?? GAME_DEFAULTS);
    return { ...this.view(room, 0), token: room.tokens[0] };
  }
  get(code) {
    this.prune();
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError(404, ruleIssue("messages.gameNotFoundOrExpired"));
    this.advanceClock(room);
    return room;
  }
  join(code, nickname = '') {
    this.validateNickname(nickname);
    const room = this.get(code);
    if (room.joined || room.started) throw new RoomError(409, ruleIssue("messages.thisGameIsFull"));
    room.nicknames ??= ['', ''];
    const player = room.tokens.findIndex(token => !token);
    room.nicknames[player] = nickname.trim();
    room.game.players[player].name = nickname.trim() || KINGDOMS[player].nickname;
    room.tokens[player] = randomBytes(32).toString('hex'); room.joined = room.tokens.every(Boolean); room.updatedAt = Date.now(); if (room.game.players.length === 4) room.revision++;
    return { ...this.view(room, player), token: room.tokens[player] };
  }
  authenticate(room, token) {
    if (typeof token !== 'string') throw new RoomError(401, ruleIssue("messages.accessDenied"));
    const player = room.tokens.findIndex(t => t && t.length === token.length && timingSafeEqual(Buffer.from(t), Buffer.from(token)));
    if (player < 0) throw new RoomError(401, ruleIssue("messages.accessDenied"));
    return player;
  }
  view(room, player) {
    // Deck order stays on the server; only visible offers are shared.
    const game = structuredClone(room.game);
    game.tileDeck = []; game.buildingDeck = []; game.missions.deck = [];
    return { code: room.code, seats: room.tokens.map(Boolean), player, joined: room.joined, started: room.started ?? true, settings: room.settings, deadline: room.deadline, serverNow: Date.now(), revision: room.revision, game,
      rerollErrors: { terrain: rerollIssue(room.game, 'terrain'), building: rerollIssue(room.game, 'building') } };
  }
  read(code, token) {
    const room = this.get(code), player = this.authenticate(room, token);
    return this.view(room, player);
  }
  command(code, token, request) {
    const room = this.get(code), player = this.authenticate(room, token);
    if (!request || typeof request.id !== 'string' || request.id.length > 100) throw new RoomError(400, ruleIssue("messages.invalidCommandID"));
    const receipt = `${player}:${request.id}`;
    if (room.receipts.has(receipt)) return this.view(room, player);
    if (!room.joined) throw new RoomError(409, ruleIssue("messages.waitingForTheSecondPlayer"));
    if (room.started === false) throw new RoomError(409, ruleIssue("messages.theGameHasNotStartedYet"));
    if (request.revision !== room.revision) throw new RoomError(409, ruleIssue("messages.theGameHasChangedTryAgain"));
    if (room.game.active !== player) throw new RoomError(403, ruleIssue("messages.itIsNotYourTurn"));
    const previousTurn = `${room.game.round}:${room.game.active}:${Boolean(room.game.opening)}`;
    room.game = applyCommand(room.game, request.command);
    if (previousTurn !== `${room.game.round}:${room.game.active}:${Boolean(room.game.opening)}`) this.setDeadline(room);
    room.revision++; room.updatedAt = Date.now(); room.receipts.set(receipt, true);
    if (room.receipts.size > 100) room.receipts.delete(room.receipts.keys().next().value);
    return this.view(room, player);
  }
  lobby(code, token, request) {
    const room = this.get(code), player = this.authenticate(room, token);
    if (player !== 0) throw new RoomError(403, ruleIssue("messages.onlyTheHostCanChangeSettingsOr"));
    if (room.started) throw new RoomError(409, ruleIssue("messages.theGameHasAlreadyStarted"));
    if (request.revision !== room.revision) throw new RoomError(409, ruleIssue("messages.theLobbyHasChangedTryAgain"));
    const settings = { ...(request.settings ?? room.settings), playerCount: request.settings?.playerCount ?? room.game.players.length };
    const count = settings.playerCount;
    if (count < room.tokens.length && room.tokens.slice(count).some(Boolean)) throw new RoomError(409, ruleIssue("multiplayer.occupiedSeats"));
    if (request.start && (count !== room.tokens.length || !room.joined)) throw new RoomError(409, ruleIssue("messages.waitForTheSecondPlayer"));
    const seconds = settings.turnSeconds ?? 0;
    if (!Number.isInteger(seconds) || (seconds !== 0 && (seconds < 30 || seconds > 180))) throw new RoomError(400, ruleIssue("messages.invalidTurnTimeLimit"));
    const game = this.gameFactory(() => randomInt(0x100000000) / 0x100000000, 'local', settings);
    startOpening(game);
    game.players.forEach((p, i) => { p.name = room.nicknames?.[i] || KINGDOMS[i].nickname; });
    room.tokens = Array.from({ length: game.players.length }, (_, i) => room.tokens[i] ?? null);
    room.nicknames = Array.from({ length: game.players.length }, (_, i) => room.nicknames?.[i] ?? "");
    room.joined = room.tokens.every(Boolean);
    room.game = game; room.settings = structuredClone(settings);
    room.started = request.start === true; room.revision++; room.updatedAt = Date.now();
    this.setDeadline(room);
    return this.view(room, player);
  }
  resign(code, token) {
    const room = this.get(code), player = this.authenticate(room, token);
    if (!room.started) throw new RoomError(409, ruleIssue("messages.theGameHasNotStarted"));
    if (!room.game.finished) {
      if (room.game.players.length === 4) {
        if (room.game.players[player].eliminated) return this.view(room, player);
        const opening = room.game.opening;
        let skipped = 0, next = room.game.active;
        if (opening) for (let step = opening.step; step < opening.totalPlacements; step++) {
          if (next === player) skipped++;
          next = nextPlayer(room.game, next, -1);
        }
        eliminatePlayer(room.game, player);
        if (opening && !room.game.finished) {
          opening.totalPlacements -= skipped;
          if (opening.step === opening.totalPlacements) {
            room.game.tileDeck.push(...opening.tiles); room.game.opening = null;
            room.game.active = firstRemainingPlayer(room.game);
          } else if (room.game.players[room.game.active].eliminated) room.game.active = nextPlayer(room.game, room.game.active, -1);
        } else if (!room.game.finished && room.game.active === player) endTurn(room.game);
        this.setDeadline(room);
      } else { room.game.finished = true; room.game.winner = 1 - player; room.game.victory = 'resignation'; room.deadline = null; } room.revision++; room.updatedAt = Date.now();
    }
    return this.view(room, player);
  }
  profile(code, token, request) {
    const room = this.get(code), player = this.authenticate(room, token);
    if (room.started) throw new RoomError(409, ruleIssue("messages.theGameHasAlreadyStarted"));
    this.validateNickname(request.nickname);
    room.nicknames ??= ['', ''];
    room.nicknames[player] = request.nickname.trim();
    room.game.players[player].name = room.nicknames[player] || KINGDOMS[player].nickname;
    room.revision++; room.updatedAt = Date.now();
    return this.view(room, player);
  }
  validateNickname(nickname) {
    if (typeof nickname !== 'string' || nickname.trim().length > 24 || /[\u0000-\u001f\u007f]/.test(nickname)) throw new RoomError(400, ruleIssue("messages.invalidNickname24CharactersMaximum"));
  }
}
