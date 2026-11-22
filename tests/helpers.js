import { rotatePoint } from "../src/geometry.js";
import { createGame as randomGame, patternAt, key, BUILDINGS } from "../src/engine.js";
// Stable setup for rule/geometry tests; deck draws still use the supplied RNG.
export function createFixedGame(rng = Math.random, mode = "local", settings = {}) {
  const draws = mode === "solo" ? 0 : (settings?.playerCount ?? 2);
  let call = 0;
  return randomGame(() => {
    const draw = call++;
    return draw < draws - 1 ? .999999 : draw === draws - 1 ? 0 : rng();
  }, mode, settings);
}
// Tests of geometric placement need an arena without preplaced objectives.
export function createSandboxGame(rng, mode, settings = {}) {
  // Fixed coordinates in placement scenarios use a 13 × 13 arena.
  const g=createFixedGame(rng, mode, { boardSize: 13, ...settings });
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

// Text assertions use this adapter; production code consumes structured issues.
import { openingIssue, attackIssue, exploreIssue, buyTerrainIssue, buildIssue } from "../src/engine.js";
import { ruleIssueText } from "../src/rule-errors.js";
const errorText = check => (...args) => {
  const issue = check(...args);
  return issue ? ruleIssueText(issue) : null;
};
export const openingError = errorText(openingIssue);
export const attackError = errorText(attackIssue);
export const exploreError = errorText(exploreIssue);
export const buyTerrainError = errorText(buyTerrainIssue);
export const buildError = errorText(buildIssue);
