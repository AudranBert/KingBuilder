import { ruleIssue, RuleError } from "./rule-errors.js";
import * as engine from './engine.js';

const actions = Object.freeze({
  moveUnitTo: engine.moveUnitTo, explore: engine.explore, build: engine.build,
  buyTerrain: engine.buyTerrain, placeOpeningTile: engine.placeOpeningTile,
  produce: engine.produce,
  trainUnit: engine.trainUnit, rerollMarket: engine.rerollMarket,
  endTurn: engine.endTurn,
});

// Both clients and servers use this protocol. Never accept a client game state.
export function applyCommand(state, command) {
  if (!command || !Object.hasOwn(actions, command.type) || !Array.isArray(command.args) || command.args.length > 6)
    throw new RuleError(ruleIssue("messages.unknownCommand"));
  const game = structuredClone(state);
  if (!game.opening && !game.finished) {
    engine.selectUnit(game, command.unit ?? null);
    if (command.army !== null && command.army !== undefined) engine.selectArmy(game, command.army);
  }
  actions[command.type](game, ...command.args);
  return game;
}
