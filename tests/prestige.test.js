import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  explore,
  build,
  buildError,
  key,
  recruit,
  endTurn,
  score,
  actor,
  rerollMarket,
  rerollError,
  buildingPayment,
  migrateGame,
  PRESTIGE,
  MISSIONS,
  missionProgress,
  assignWorker,
  RULES,
} from "../dist/engine.js";
import { validateGame, createPersistence, SAVE_KEY } from "../dist/storage.js";
import { compileConfiguration } from "../dist/config-schema.js";
import { readFile } from "node:fs/promises";
const configs = await Promise.all(
  [
    "terrain-tiles",
    "buildings",
    "resources",
    "units",
    "game-rules",
    "terrains",
    "missions",
  ].map((n) =>
    readFile(new URL(`../dist/config/${n}.json`, import.meta.url), "utf8").then(
      JSON.parse,
    ),
  ),
);
function quiet(g) {
  g.players[0].prestige = 1;
  g.missions = {
    tiered: 1,
    market: ["explore-20", "forest-6", "stock-iron"],
    deck: [],
    claimed: [],
  };
  return g;
}
function buildReady() {
  const g = quiet(createGame());
  g.players[0].x = 2;
  g.board[key(2, 6)] = { terrain: "plain" };
  g.buildingMarket[0] = "house";
  return g;
}
test("prestige initial, score et trois missions communes sauvegardables", () => {
  const g = createGame();
  assert.deepEqual(
    g.players.map((p) => p.prestige),
    [0, 1],
  );
  assert.equal(score(g, 0).prestige, 0);
  assert.equal(g.missions.market.length, 3);
  assert.equal(
    new Set([...g.missions.market, ...g.missions.deck]).size,
    Object.keys(MISSIONS).length,
  );
  assert.equal(validateGame(g), g);
  g.players[0].prestige = 4;
  assert.equal(score(g, 0).prestige, 12);
});
test("premier arrivé : récompense unique et remplacement immédiat de la mission", () => {
  const g = createGame();
  g.missions = {
    tiered: 1,
    market: ["forest-3", "explore-12", "stock-iron"],
    deck: ["explore-6", "build-4"],
    claimed: [],
  };
  const tile = {
    cells: [
      { x: 0, y: 0, terrain: "forest" },
      { x: 1, y: 0, terrain: "forest" },
      { x: 2, y: 0, terrain: "forest" },
    ],
  };
  g.tileMarket[0] = structuredClone(tile);
  explore(g, 0, 1, 6);
  assert.equal(g.players[0].prestige, 1);
  assert.equal(g.missions.claimed.length, 1);
  assert.equal(g.missions.claimed[0].owner, 0);
  assert.ok(g.missions.market.includes("build-4"));
  endTurn(g);
  g.tileMarket[0] = structuredClone(tile);
  explore(g, 0, 10, 6, 2);
  assert.equal(g.players[1].prestige, 1);
  assert.equal(g.missions.claimed.length, 1);
  assert.equal(missionProgress(g, "forest-3", 0), 3);
  assert.equal(missionProgress(g, "forest-3", 1), 3);
});
test("la forêt révélée reste comptée après un défrichement et les cases initiales sont exclues", () => {
  const g = quiet(createGame());
  assert.equal(missionProgress(g, "plain-3"), 0);
  g.tileMarket[0] = { cells: [{ x: 0, y: 0, terrain: "forest" }] };
  explore(g, 0, 1, 6);
  assert.equal(missionProgress(g, "forest-3"), 1);
  endTurn(g);
  endTurn(g);
  g.players[0].x = 1;
  g.buildingMarket[0] = "clearing";
  build(g, 0, 1, 6);
  assert.equal(missionProgress(g, "forest-3"), 1);
  assert.equal(missionProgress(g, "build-2"), 0);
});
test("constructions et recrutements excluent la maison et l’ouvrier de départ", () => {
  const g = buildReady();
  g.missions = {
    tiered: 1,
    market: ["build-2", "workers-1", "stock-iron"],
    deck: [],
    claimed: [],
  };
  assert.equal(missionProgress(g, "build-2"), 0);
  assert.equal(missionProgress(g, "workers-1"), 0);
  build(g, 0, 2, 6);
  assert.equal(missionProgress(g, "build-2"), 1);
  recruit(g);
  assert.equal(g.players[0].prestige, 2);
  assert.equal(missionProgress(g, "workers-1"), 1);
  assert.equal(g.missions.claimed[0].id, "workers-1");
});
test("les ressources gagnées par la dernière production peuvent remporter une mission", () => {
  const g = quiet(createGame());
  g.active = 1;
  g.round = RULES.rounds;
  g.missions = {
    tiered: 1,
    market: ["stock-wood", "forest-6", "explore-20"],
    deck: [],
    claimed: [],
  };
  g.board[key(9, 6)] = {
    terrain: "forest",
    building: { type: "sawmill", owner: 1 },
  };
  assignWorker(g, 0, 9, 6);
  g.players[1].resources.wood = 4;
  endTurn(g);
  assert.equal(g.finished, true);
  assert.equal(g.players[1].prestige, 2);
  assert.equal(score(g, 1).prestige, 6);
});
test("relancer paie un prestige, conserve les cartes et ne termine pas l’unité", () => {
  const g = quiet(createGame());
  const before = structuredClone(actor(g)),
    old = [...g.tileMarket],
    fresh = g.tileDeck.slice(0, 3),
    all = [...g.tileDeck, ...old].map((t) => t.id).sort((a, b) => a - b);
  rerollMarket(g, "terrain");
  assert.deepEqual(g.tileMarket, fresh);
  assert.deepEqual(g.tileDeck.slice(-3), old);
  assert.equal(g.players[0].prestige, 0);
  assert.deepEqual(actor(g), before);
  assert.deepEqual(
    [...g.tileDeck, ...g.tileMarket].map((t) => t.id).sort((a, b) => a - b),
    all,
  );
  g.players[0].prestige = 2;
  const snapshot = structuredClone(g);
  assert.throws(() => rerollMarket(g, "building"), /déjà/);
  assert.deepEqual(g, snapshot);
  endTurn(g);
  assert.equal(g.rerollsUsed, 0);
  rerollMarket(g, "building");
  assert.equal(g.players[1].prestige, 0);
});
test("relance refusée sans prestige, nouvelles cartes ou après fin sans aucune mutation", () => {
  for (const change of [
    (g) => (g.players[0].prestige = 0),
    (g) => (g.tileDeck = []),
    (g) => (g.finished = true),
  ]) {
    const g = quiet(createGame());
    change(g);
    const before = structuredClone(g);
    assert.ok(rerollError(g, "terrain"));
    assert.throws(() => rerollMarket(g, "terrain"));
    assert.deepEqual(g, before);
  }
});
test("joker : ressources disponibles d’abord, un prestige par ressource manquante et confirmation obligatoire", () => {
  const g = buildReady();
  g.players[0].resources = { wood: 1, stone: 0, wheat: 1, iron: 0 };
  g.players[0].prestige = 3;
  assert.deepEqual(buildingPayment(g, 0), {
    resources: { wood: 1, stone: 0 },
    missing: { wood: 1, stone: 1 },
    prestige: 2,
    affordable: true,
  });
  assert.equal(buildError(g, 0, 2, 6, 0, { allowPrestige: true }), null);
  let snapshot = structuredClone(g);
  assert.throws(() => build(g, 0, 2, 6));
  assert.deepEqual(g, snapshot);
  assert.throws(() => build(g, 0, 2, 6, 0, { allowPrestige: true }));
  assert.deepEqual(g, snapshot);
  assert.throws(() =>
    build(g, 0, 2, 6, 0, { allowPrestige: true, expectedPrestige: 1 }),
  );
  assert.deepEqual(g, snapshot);
  build(g, 0, 2, 6, 0, { allowPrestige: true, expectedPrestige: 2 });
  assert.equal(g.players[0].prestige, 1);
  assert.equal(g.players[0].resources.wood, 0);
  assert.equal(g.players[0].resources.stone, 0);
  assert.equal(g.players[0].resources.wheat, 1);
  assert.equal(g.acted, true);
});
test("joker : terrain invalide, prestige insuffisant ou paiement modifié ne dépensent rien", () => {
  for (const change of [
    (g) => (g.players[0].prestige = 0),
    (g) => (g.board[key(2, 6)].terrain = "river"),
  ]) {
    const g = buildReady();
    g.players[0].resources.wood = 1;
    change(g);
    const before = structuredClone(g);
    assert.throws(() =>
      build(g, 0, 2, 6, 0, { allowPrestige: true, expectedPrestige: 1 }),
    );
    assert.deepEqual(g, before);
  }
  const g = buildReady();
  g.players[0].resources.wood = 1;
  const before = structuredClone(g);
  assert.throws(() =>
    build(g, 0, 2, 6, 0, { allowPrestige: true, expectedPrestige: 2 }),
  );
  assert.deepEqual(g, before);
});
test("les sauvegardes conservent prestige, missions attribuées, progression et relance", () => {
  const g = quiet(createGame());
  g.missions = {
    tiered: 1,
    market: ["workers-1", "explore-20", "stock-iron"],
    deck: [],
    claimed: [],
  };
  recruit(g);
  rerollMarket(g, "terrain");
  const memory = new Map([[SAVE_KEY, JSON.stringify(g)]]);
  const storage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
  };
  assert.deepEqual(createPersistence(storage).load(), g);
  const old = structuredClone(g);
  delete old.missions;
  delete old.rerollsUsed;
  for (const p of old.players) {
    delete p.prestige;
    delete p.progress;
  }
  migrateGame(old);
  assert.equal(old.players[0].prestige, 0);
  assert.equal(old.missions.market.length, 3);
  assert.equal(validateGame(old), old);
  const again = structuredClone(old);
  migrateGame(old);
  assert.deepEqual(old, again);
});
test("configurations de missions et récompenses invalides sont refusées", () => {
  for (const mutate of [
    (c) => (c[6].missions[0].target = 0),
    (c) => (c[6].missions[0].reward.prestige = -1),
    (c) => (c[6].missions[0].metric = "inconnu"),
    (c) => (c[6].missions[0].terrain = "inconnu"),
    (c) => c[6].missions.push(c[6].missions[0]),
    (c) => (c[4].prestige.wildcardCost = 0),
    (c) => (c[4].scoring.prestige = -1),
  ]) {
    const input = structuredClone(configs);
    mutate(input);
    assert.throws(
      () => compileConfiguration(...input),
      /Configuration invalide/,
    );
  }
  const input = structuredClone(configs);
  input[6].missions[0].reward.prestige = 2;
  assert.equal(
    compileConfiguration(...input).missions[input[6].missions[0].id].reward
      .prestige,
    2,
  );
});

test("chaque objectif existe en trois niveaux et les trois offres initiales sont faciles", () => {
  const families = new Map();
  for (const m of Object.values(MISSIONS)) {
    if (!families.has(m.family)) families.set(m.family, []);
    families.get(m.family).push(m);
  }
  assert.equal(families.size, 16);
  assert.equal(Object.keys(MISSIONS).length, 48);
  for (const variants of families.values()) {
    variants.sort((a, b) => a.difficulty - b.difficulty);
    assert.deepEqual(
      variants.map((m) => m.difficulty),
      [1, 2, 3],
    );
    assert.ok(
      variants[0].target < variants[1].target &&
        variants[1].target < variants[2].target,
    );
  }
  for (const rng of [() => 0.1, () => 0.5, () => 0.9]) {
    const g = createGame(rng);
    assert.equal(g.missions.market.length, 3);
    assert.ok(g.missions.market.every((id) => MISSIONS[id].difficulty === 1));
    assert.equal(g.missions.deck.length, 45);
  }
});
test("chaque emplacement monte de niveau indépendamment puis reste à trois étoiles", async () => {
  const { settleMissions } = await import("../dist/prestige.js");
  const g = createGame();
  const hardIron = Object.values(MISSIONS).find(
    (m) =>
      m.metric === "resources" && m.resource === "iron" && m.difficulty === 3,
  ).id;
  g.missions = {
    tiered: 1,
    market: ["forest-3", "plain-3", "mountain-3"],
    deck: ["river-3", "explore-20", "build-4", hardIron],
    claimed: [],
  };
  g.players[0].progress.terrain.forest = 3;
  assert.deepEqual(settleMissions(g), ["forest-3"]);
  assert.deepEqual(g.missions.market, ["build-4", "plain-3", "mountain-3"]);
  g.players[0].progress.built.house = 4;
  assert.deepEqual(settleMissions(g), ["build-4"]);
  assert.deepEqual(g.missions.market, ["explore-20", "plain-3", "mountain-3"]);
  g.players[0].revealed = 20;
  assert.deepEqual(settleMissions(g), ["explore-20"]);
  assert.deepEqual(g.missions.market, [hardIron, "plain-3", "mountain-3"]);
  g.players[0].resources.iron = 8;
  assert.deepEqual(settleMissions(g), [hardIron]);
  assert.deepEqual(g.missions.market, ["plain-3", "mountain-3"]);
  assert.deepEqual(g.missions.deck, ["river-3"]);
  assert.equal(new Set(g.missions.claimed.map((c) => c.id)).size, 4);
});
test("une nouvelle offre déjà remplie peut monter plusieurs niveaux sans boucle ni récompense double", async () => {
  const { settleMissions } = await import("../dist/prestige.js");
  const g = createGame();
  g.missions = {
    tiered: 1,
    market: ["explore-6", "forest-3", "plain-3"],
    deck: ["explore-12", "explore-20"],
    claimed: [],
  };
  g.players[0].revealed = 30;
  assert.deepEqual(settleMissions(g), [
    "explore-6",
    "explore-12",
    "explore-20",
  ]);
  assert.equal(g.players[0].prestige, 3);
  assert.deepEqual(settleMissions(g), []);
  assert.equal(g.players[0].prestige, 3);
});
test("les anciens catalogues migrent une seule fois sans perdre prestige ou missions gagnées", () => {
  const g = createGame();
  g.missions = {
    market: ["forest-6", "build-2", "stock-iron"],
    deck: ["explore-6"],
    claimed: [{ id: "workers-1", owner: 0, round: 1 }],
  };
  g.players[0].prestige = 5;
  migrateGame(g);
  assert.deepEqual(g.missions.market, ["forest-6", "build-2", "stock-iron"]);
  assert.equal(g.players[0].prestige, 5);
  const ids = [
    ...g.missions.market,
    ...g.missions.deck,
    ...g.missions.claimed.map((c) => c.id),
  ];
  assert.equal(ids.length, 48);
  assert.equal(new Set(ids).size, 48);
  const before = structuredClone(g);
  migrateGame(g);
  assert.deepEqual(g, before);
  assert.equal(validateGame(g), g);
});
test("configuration : niveaux manquants, doublons et seuils incohérents sont refusés", () => {
  for (const mutate of [
    (c) => (c.missions[0].difficulty = 4),
    (c) => (c.missions[0].difficulty = 2),
    (c) => c.missions.splice(0, 1),
    (c) => (c.missions[1].target = c.missions[0].target),
    (c) => (c.missions[1].terrain = "forest"),
    (c) => delete c.missions[0].family,
  ]) {
    const input = structuredClone(configs);
    mutate(input[6]);
    assert.throws(() => compileConfiguration(...input), /missions.json/);
  }
});
