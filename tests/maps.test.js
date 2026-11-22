import { openingError } from "./helpers.js";
import { createFixedGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAPS, mapCells } from "../src/maps.js";
import { gameSettings, startOpening, placeOpeningTile } from "../src/engine.js";
import { validateGame } from "../src/validation.js";

test("les cartes dispersées conservent leurs tuiles séparées des drapeaux symétriques", () => {
  const fiveFlagLayouts = new Set();
  for (const [id, flagCount, tileCount, terrainCount] of [
    ['scattered_lands', 5, 5, 14], ['patchwork', 3, 5, 14],
    ['borderlands', 5, 4, 12], ['broken_country', 5, 5, 17], ['mosaic', 3, 4, 13],
  ]) {
    const map = MAPS.find(map => map.id === id);
    const tiles = map.zones.filter(zone => !zone.rows.join('').includes('!'));
    assert.equal(tiles.length, tileCount);
    for (const size of [9, 11, 13]) {
      const cells = mapCells(map, size);
      const flags = new Set([...cells].filter(([, cell]) => cell.flag).map(([position]) => position));
      assert.equal(flags.size, flagCount);
      assert.equal(cells.size, terrainCount + flagCount);
      if (size === 11) {
        const terrainX = [...cells].filter(([, cell]) => !cell.flag).map(([position]) => Number(position.split(',')[0]));
        const left = terrainX.filter(x => x < 5).length, right = terrainX.filter(x => x > 5).length;
        assert.ok(Math.abs(left - right) <= 2, `${id} : répartition gauche/droite ${left}/${right}`);
        assert.ok([...cells].some(([position, cell]) => !cell.flag && position.split(',').map(Number).some(n => n === 0 || n === 10)), `${id} : terrain sur un bord en 11 × 11`);
        if (flagCount === 5) fiveFlagLayouts.add([...flags].sort().join(';'));
      }
      if (flagCount === 3) {
        const isletFlags = new Set([...mapCells(MAPS.find(map => map.id === 'islands'), size)]
          .filter(([, cell]) => cell.flag).map(([position]) => {
            if (id !== 'mosaic') return position;
            const [x, y] = position.split(',').map(Number);
            return `${size - 1 - x},${y}`;
          }));
        assert.deepEqual(flags, isletFlags);
      }
      if (id === 'borderlands') {
        const edgeTiles = tiles.filter(zone => [...mapCells({ ...map, variants: undefined, zones: [zone] }, size).keys()]
          .some(position => position.split(',').map(Number).some(n => n === 0 || n === size - 1)));
        assert.equal(edgeTiles.length, 3);
      }
      if (id === 'scattered_lands' && size === 11) {
        assert.deepEqual(flags, new Set(['3,1', '6,3', '5,5', '4,7', '7,9']));
      }
      for (const position of flags) {
        const [x, y] = position.split(',').map(Number);
        assert.ok(flags.has(`${size - 1 - x},${size - 1 - y}`));
        if (flagCount === 5 && id !== 'scattered_lands') {
          assert.ok(flags.has(`${size - 1 - x},${y}`));
          assert.ok(flags.has(`${x},${size - 1 - y}`));
        }
      }
    }
  }
  assert.equal(fiveFlagLayouts.size, 3, 'les trois cartes à cinq drapeaux ont des dispositions distinctes');
});

test("la draft optionnelle se termine sur chaque carte sans modifier ses cases initiales", () => {
  for (const map of MAPS.filter(map => !map.playerCount)) for (const boardSize of [9, 11, 13]) for (const mode of ['solo', 'local']) for (const count of [1, 2]) {
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
  for (const map of MAPS.filter(map => !map.playerCount)) for (let boardSize = 9; boardSize <= 13; boardSize += 2) {
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
  const regularMaps = MAPS.filter(map => !map.playerCount);
  for (const value of regularMaps.map((_, i) => (i + .5) / regularMaps.length)) {
    const game = createGame(() => value, 'local', { mapId: 'random' });
    selected.add(game.mapId);
    assert.deepEqual(game.board, createGame(() => .3, 'local', { mapId: game.mapId }).board);
  }
  assert.equal(selected.size, regularMaps.length);
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
