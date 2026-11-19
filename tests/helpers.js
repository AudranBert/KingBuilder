import { createGame } from "../src/engine.js";
// Tests of geometric placement need an arena without preplaced objectives.
export function createSandboxGame(...args) {
  const g=createGame(...args);
  for(const [pos,c] of Object.entries(g.board)) if(c.flag) delete g.board[pos];
  return g;
}
