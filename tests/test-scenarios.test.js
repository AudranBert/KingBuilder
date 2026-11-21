import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArmyTestGame } from '../src/test-scenarios.js';
import { createGame, armyAt, defenseAt, selectedSoldiers, selectUnit } from '../src/engine.js';
import { validateGame } from '../src/validation.js';

test('le scénario local démarre avec deux soldats disponibles sur le donjon', () => {
  const game = createArmyTestGame(), player = game.players[0];
  const army = armyAt(game, 0, player.home.x, player.home.y);
  assert.equal(army.length, 2);
  assert.ok(army.every(unit => !unit.acted && !unit.ended && unit.moves > 0));
  assert.doesNotThrow(() => validateGame(game));
  selectUnit(game, army[0].id);
  assert.equal(selectedSoldiers(game).length, 2);
  assert.equal(defenseAt(game, 0, player.home.x, player.home.y).defense, 4);
  assert.equal(createGame().players[0].units.filter(u=>u.type==='soldier').length, 0);
});
