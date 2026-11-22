import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, endTurn, totalScore, score, selectUnit } from "../src/engine.js";
import { initializeMissions, settleMissions, militaryPower } from "../src/objectives.js";
import { missionsView, resultsView } from "../src/ui/views.js";
import { validateGame } from "../src/validation.js";
import { setLanguage, translateMessage } from "../src/i18n.js";
import { applyCommand } from "../src/commands.js";

function offers(g, ids) {
  g.missions = { market: ids, deck: [], claimed: [], tiered: 1 };
  initializeMissions(g);
}

test("récompenses croisées et mixtes : stocks crédités une fois sans augmenter la production", () => {
  const g = createGame(), p = g.players[0], before = { ...p.resources };
  offers(g, ["produced-material-4", "produced-food-4", "build-2"]);
  p.progress.produced = { material: 5, food: 5 };
  p.progress.built = { farm: 1, sawmill: 1 };
  assert.deepEqual(settleMissions(g), ["produced-material-4", "produced-food-4", "build-2"]);
  assert.deepEqual(p.resources, { ...before, food: before.food + 3, material: before.material + 3 });
  assert.deepEqual(p.progress.produced, { material: 5, food: 5 });
  assert.deepEqual(settleMissions(g), []);
});

test("soldats offerts : bon propriétaire, donjon, identifiants uniques et activation au prochain tour", () => {
  const g = createGame(), p = g.players[0];
  offers(g, ["built-food-2", "military-4"]);
  p.progress.built.farm = 3;
  const original = { ...p.resources };
  g.active = 1;
  assert.deepEqual(settleMissions(g, 0), ["built-food-2", "military-4"]);
  const recruits = p.units.filter(u => u.type === "soldier");
  assert.equal(recruits.length, 2);
  assert.equal(g.players[1].units.filter(u => u.type === "soldier").length, 0);
  assert.equal(militaryPower(g, 0), 4);
  assert.equal(p.resources.material, original.material + 2);
  assert.equal(p.resources.food, original.food);
  assert.equal(new Set(p.units.map(u => u.id)).size, p.units.length);
  for (const unit of recruits) {
    assert.equal(unit.x, p.home.x); assert.equal(unit.y, p.home.y);
    assert.equal(unit.moves, 0); assert.equal(unit.acted, true); assert.equal(unit.ended, true);
  }
  validateGame(structuredClone(g));
  endTurn(g);
  assert.equal(g.active, 0);
  assert.ok(recruits.every(u => u.moves === 3 && !u.acted && !u.ended));
});

test("les points de mission restent acquis dans le score actuel et final après sérialisation", () => {
  const g = createGame();
  offers(g, ["produced-gold-3", "landscaping-4"]);
  const before = totalScore(g, 0), gold = g.players[0].resources.gold;
  g.players[0].progress.produced.gold = 5;
  g.players[0].progress.landscaping = 4;
  settleMissions(g);
  assert.equal(totalScore(g, 0), before + 3);
  assert.equal(g.players[0].resources.gold, gold);
  assert.equal(score(g, 0).missions, 3);
  const restored = validateGame(JSON.parse(JSON.stringify(g)));
  restored.finished = true;
  assert.equal(score(restored, 0).missions, 3);
  assert.match(resultsView(restored), /Points des missions/);
  assert.doesNotMatch(resultsView(restored), /undefined/);
  restored.players[0].missionScore = -1;
  assert.throws(() => validateGame(restored), /score de missions/);
});

test("cartes et journal décrivent les récompenses réelles dans les deux langues", () => {
  const g = createGame();
  offers(g, ["build-2", "built-food-1", "produced-gold-3"]);
  try {
    for (const language of ["fr", "en"]) {
      setLanguage(language, { persist: false });
      const cards = missionsView(g);
      assert.match(cards, /wood\.svg/); assert.match(cards, /wheat\.svg/); assert.match(cards, /soldier\.svg/);
      assert.doesNotMatch(cards, /undefined|NaN/);
      assert.match(cards, language === "fr" ? /\+1 soldat\(s\) au donjon/ : /\+1 soldier\(s\) at the keep/);
      assert.match(cards, /\+1 point\(s\)/);
    }
    setLanguage("fr", { persist: false });
    offers(g, ["produced-material-4"]);
    g.players[0].progress.produced.material = 4;
    const worker = g.players[0].units[0];
    Object.assign(worker, { x: 2, y: 2 });
    g.board["2,2"] = { terrain: "forest" };
    selectUnit(g, worker.id);
    const next = applyCommand(g, { type: "produce", unit: worker.id, args: [] });
    const rewardLog = next.log.find(entry => entry.includes("Produce 5 wood"));
    assert.ok(rewardLog);
    assert.match(translateMessage(rewardLog), /Produire 5 bois.*\+2 blé/);
    assert.doesNotMatch(translateMessage(rewardLog), /undefined|gold|wheat/);
  } finally { setLanguage("fr", { persist: false }); }
});
