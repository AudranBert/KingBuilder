import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, startOpening, moveUnitTo, endTurn } from "../src/engine.js";
import { LocalSave, LOCAL_SAVE_KEY } from "../src/local-save.js";

function memory() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}

test("local save restores full games, including setup, decks and the next turn", () => {
  for (const mode of ["local", "solo"]) {
    const storage = memory(), save = new LocalSave(() => storage);
    const game = createGame(Math.random, mode, { openingTilesPerPlayer: 1 });
    startOpening(game);
    assert.equal(save.save(game), true);
    assert.deepEqual(new LocalSave(() => storage).resume(), game);
    const playing = createGame(Math.random, mode);
    save.start();
    moveUnitTo(playing, 1, 6);
    endTurn(playing);
    save.save(playing);
    assert.deepEqual(new LocalSave(() => storage).resume(), playing);
    playing.finished = true;
    save.save(playing);
    assert.equal(new LocalSave(() => storage).resume(), null);
  }
});

test("corrupt, incompatible and online states cannot be resumed locally; storage failure is harmless", () => {
  const storage = memory(), save = new LocalSave(() => storage);
  for (const raw of ["{", "null", JSON.stringify({ version: 1, id: "old", game: { version: 0 } })]) {
    storage.setItem(LOCAL_SAVE_KEY, raw);
    assert.equal(save.resume(), null);
  }
  const game = createGame();
  save.save(game);
  const before = storage.getItem(LOCAL_SAVE_KEY);
  assert.equal(save.save({ ...game, onlineCode: "ABCDEF1234" }), true);
  assert.equal(storage.getItem(LOCAL_SAVE_KEY), before);
  const blocked = new LocalSave(() => { throw Error("denied"); });
  assert.equal(blocked.resume(), null);
  assert.equal(blocked.save(game), false);
  assert.equal(new LocalSave(() => undefined).save(game), false);
});

test("finishing an older game does not delete a newer game's save", () => {
  const storage = memory(), first = new LocalSave(() => storage), second = new LocalSave(() => storage);
  const older = createGame(), newer = createGame();
  first.save(older);
  second.save(newer);
  older.finished = true;
  first.save(older);
  assert.deepEqual(second.resume(), newer);
});
