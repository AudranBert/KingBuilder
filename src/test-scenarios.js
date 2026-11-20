import { createGame, UNIT_DEFINITIONS } from './engine.js';

// Opt-in local scenario; ordinary games keep their normal starting units.
export function createArmyTestGame() {
  const game = createGame(() => .42, 'solo', { openingTilesPerPlayer: 0 });
  const player = game.players[0];
  for (let i = 0; i < 2; i++) player.units.push({
    id: player.nextUnitId++,
    type: 'soldier',
    x: player.home.x,
    y: player.home.y,
    home: { ...player.home },
    moves: UNIT_DEFINITIONS.soldier.moves,
    acted: false,
    ended: false,
    skipTurns: 0,
  });
  return game;
}
