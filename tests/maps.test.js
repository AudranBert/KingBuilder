import { test } from "node:test";
import assert from "node:assert/strict";
import { MAPS, mapCells } from "../src/maps.js";
import { createGame, gameSettings, startOpening, openingError, placeOpeningTile } from "../src/engine.js";
import { validateGame } from "../src/validation.js";

test("la draft optionnelle se termine sur chaque carte sans modifier ses cases initiales", () => {
  for (const map of MAPS) for (const boardSize of [9, 11, 13]) for (const mode of ['solo', 'local']) for (const count of [1, 2]) {
    const game = createGame(() => .5, mode, { mapId: map.id, boardSize, openingTilesPerPlayer: count });
    const board = structuredClone(game.board);
    startOpening(game);
    assert.equal(game.opening.totalPlacements, count * game.players.length);
    while (game.opening) {
      let placement;
      for (let tile = 0; tile < game.opening.tiles.length && !placement; tile++)
        for (let rotation = 0; rotation < 4 && !placement; rotation++)
          for (let y = 0; y < boardSize && !placement; y++)
            for (let x = 0; x < boardSize && !placement; x++)
              if (!openingError(game, tile, x, y, rotation)) placement = [tile, x, y, rotation];
      assert.ok(placement, `${map.id} ${boardSize} : préparation bloquée`);
      placeOpeningTile(game, ...placement);
    }
    assert.equal(game.active, 0);
    assert.equal(game.round, 1);
    assert.ok(game.players.every(player => player.revealed === 0));
    for (const [position, cell] of Object.entries(board)) assert.deepEqual(game.board[position], cell);
    assert.doesNotThrow(() => validateGame(game));
  }
});

test("chaque carte fonctionne pour toutes les tailles, en solo et en duel", () => {
  assert.equal(new Set(MAPS.map(map => map.id)).size, MAPS.length);
  for (const map of MAPS) for (let boardSize = 9; boardSize <= 13; boardSize += 2) {
    for (const mode of ['solo', 'local']) {
      const game = createGame(() => .5, mode, { mapId: map.id, boardSize });
      assert.equal(game.mapId, map.id);
      assert.equal(Object.values(game.board).filter(cell => cell.flag).length, [...mapCells(map, boardSize).values()].filter(cell => cell.flag).length);
      for (const [position, cell] of mapCells(map, boardSize)) assert.deepEqual(game.board[position], cell);
      assert.ok(game.players.every(p => game.board[`${p.home.x},${p.home.y}`].building));
      const deck = structuredClone(game.tileDeck);
      startOpening(game);
      assert.equal(game.opening, null);
      assert.equal(game.active, 0);
      assert.deepEqual(game.tileDeck, deck);
      assert.doesNotThrow(() => validateGame(game));
      assert.equal(validateGame(JSON.parse(JSON.stringify(game))).mapId, map.id);
    }
  }
});

test("le hasard choisit une carte du catalogue et sa disposition reste fixe", () => {
  assert.equal(gameSettings().mapId, 'base');
  const selected = new Set();
  for (const value of MAPS.map((_, i) => (i + .5) / MAPS.length)) {
    const game = createGame(() => value, 'local', { mapId: 'random' });
    selected.add(game.mapId);
    assert.deepEqual(game.board, createGame(() => .3, 'local', { mapId: game.mapId }).board);
  }
  assert.equal(selected.size, MAPS.length);
  assert.throws(() => gameSettings({ mapId: 'missing' }), /Carte inconnue/);
});

test("le scaling conserve les motifs et les variantes remplacent les zones", () => {
  const map = MAPS.find(map => map.id === 'clearings');
  const normalized = size => [...mapCells(map, size)].map(([position, cell]) => {
    const [x, y] = position.split(',').map(Number), center = Math.floor((size - 1) / 2);
    return [x - center, y - center, cell];
  });
  assert.deepEqual(normalized(9), normalized(13));
  assert.throws(() => mapCells({ ...map, zones: [map.zones[0], map.zones[0]] }, 11), /superposées/);
  assert.throws(() => mapCells({ ...map, zones: [{ ...map.zones[0], offset: [-20, 0] }] }, 11), /invalide/);
});

test("Nouveau monde conserve cinq drapeaux symétriques et aucun terrain supplémentaire", () => {
  const map = MAPS.find(map => map.id === 'base');
  assert.equal(map.name, 'New lands');
  for (const boardSize of [9, 11, 13]) {
    const positions = mapCells(map, boardSize);
    const center = (boardSize - 1) / 2;
    assert.equal(positions.size, 5);
    assert.ok(positions.has(`${center},${center}`));
    for (const [position, cell] of positions) {
      const [x, y] = position.split(',').map(Number);
      assert.deepEqual(cell, { terrain: 'plain', flag: { owner: null } });
      assert.ok(positions.has(`${boardSize - 1 - x},${y}`), `symétrie horizontale ${boardSize} : ${position}`);
      assert.ok(positions.has(`${x},${boardSize - 1 - y}`), `symétrie verticale ${boardSize} : ${position}`);
    }
    for (const mode of ['solo', 'local']) {
      const base = createGame(() => .5, mode, { mapId: 'base', boardSize });
      const original = createGame(() => .5, mode, { mapId: null, boardSize });
      const withoutFlags = board => Object.fromEntries(Object.entries(board).filter(([, cell]) => !cell.flag));
      assert.deepEqual(withoutFlags(base.board), withoutFlags(original.board));
      assert.equal(base.openingTilesPerPlayer, 0);
      if ([9, 13].includes(boardSize)) assert.deepEqual(base.board, original.board);
    }
  }
});
