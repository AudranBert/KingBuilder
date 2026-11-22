import { rotatePoint } from "../src/geometry.js";
import { createGame, patternAt, key, BUILDINGS } from "../src/engine.js";
// Tests of geometric placement need an arena without preplaced objectives.
export function createSandboxGame(rng, mode, settings = {}) {
  // Fixed coordinates in placement scenarios use a 13 × 13 arena.
  const g=createGame(rng, mode, { boardSize: 13, ...settings });
  for(const [pos,c] of Object.entries(g.board)) if(c.flag) delete g.board[pos];
  return g;
}

// Reveal the current configured pattern, including required neighbouring buildings.
export function prepareBuilding(game, type, x, y, rotation = 0) {
  for (const cell of patternAt(type, x, y, rotation)) {
    game.board[key(cell.x, cell.y)] = {
      terrain: cell.terrain[0],
      ...(cell.symbol === "c" ? { building: { type: "house", owner: game.active } } : {}),
    };
  }
  if (BUILDINGS[type].toll) for (const direction of [-1, 1]) {
    const offset = rotatePoint(direction, 0, rotation);
    game.board[key(x + offset.x, y + offset.y)] = { terrain: "mountain" };
  }
}
