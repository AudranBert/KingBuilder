import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { compileConfiguration } from "../dist/config-schema.js";
const originals = await Promise.all(
  [
    "terrain-tiles",
    "buildings",
    "resources",
    "units",
    "game-rules",
    "terrains",
    "missions",
  ].map((name) =>
    readFile(
      new URL(`../dist/config/${name}.json`, import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ),
);
const configs = () => structuredClone(originals);
test("les sept fichiers définissent treize formes, dix bâtiments et quatre ressources", () => {
  const input = configs(),
    before = structuredClone(input),
    c = compileConfiguration(...input);
  assert.equal(Object.keys(c.shapes).length, 13);
  assert.equal(Object.keys(c.buildings).length, 10);
  assert.equal(Object.keys(c.resources).length, 4);
  assert.equal(Object.keys(c.units).length, 1);
  assert.equal(input[1].units, undefined);
  assert.equal(c.units.cavalry.moves, 2);
  assert.deepEqual(input, before);
  assert.deepEqual(c.shapes.t5.pattern, ["xxx", ".x.", ".x."]);
  assert.equal(c.shapes.t5.cells.length, 5);
  assert.ok(Object.values(c.shapes).every((s) => s.cells.length <= 5));
});
test("aucune limite mécanique : les motifs de six cases sont acceptés", () => {
  const input = configs();
  input[0].shapes.push({
    id: "future6",
    name: "Forme future de six",
    weight: 1,
    pattern: ["xxxxxx"],
  });
  input[1].buildings[0].layout = ["Bfffff"];
  input[1].buildings[0].legend = { f: { terrain: ["plain"], role: "field" } };
  const c = compileConfiguration(...input);
  assert.equal(c.shapes.future6.cells.length, 6);
  assert.equal(c.buildings.house.cells.length, 6);
});
test("motifs vides, disjoints et symboles incorrects sont refusés", () => {
  for (const pattern of [["..."], ["x.x"], ["xy"]]) {
    const input = configs();
    input[0].shapes[0].pattern = pattern;
    assert.throws(() => compileConfiguration(...input), /terrain-tiles.json/);
  }
});
test("motifs des bâtiments : une entrée unique et des symboles de légende connus", () => {
  for (const layout of [["ff"], ["BB"], ["Bz"]]) {
    const input = configs();
    input[1].buildings[0].layout = layout;
    assert.throws(() => compileConfiguration(...input), /buildings.json/);
  }
});
test("identifiants en double et poids ou tailles de pioche incorrects sont refusés", () => {
  const duplicate = configs();
  duplicate[0].shapes.push(duplicate[0].shapes[0]);
  assert.throws(() => compileConfiguration(...duplicate), /double/);
  for (const n of [0, -1, 1.5]) {
    const input = configs();
    input[0].shapes[0].weight = n;
    assert.throws(() => compileConfiguration(...input), /weight/);
  }
  const small = configs();
  small[0].deckSize = 2;
  assert.throws(() => compileConfiguration(...small), /pioche/);
});
test("les références aux ressources, aux bâtiments et aux terrains sont vérifiées", () => {
  for (const change of [
    (input) => (input[1].buildings[0].cost = { unknown: 1 }),
    (input) => (input[1].buildings[1].produces = "unknown"),
    (input) => (input[2].recruitmentCost = { unknown: 1 }),
    (input) => (input[1].buildings[8].boost.target = "unknown"),
    (input) => (input[0].legend.P = "unknown"),
  ]) {
    const input = configs();
    change(input);
    assert.throws(
      () => compileConfiguration(...input),
      /inconnu|terrains|boost/,
    );
  }
});
test("une erreur de coût, de production ou de bâtiment initial est signalée", () => {
  for (const change of [
    (input) => (input[1].buildings[0].cost.wood = -1),
    (input) => (input[1].buildings[1].production = 0),
    (input) => (input[2].resources[0].startingAmount = -1),
    (input) => (input[1].startingBuilding = "farm"),
  ]) {
    const input = configs();
    change(input);
    assert.throws(
      () => compileConfiguration(...input),
      /Configuration invalide/,
    );
  }
});
test("les définitions d’unités et les options des casernes sont validées", () => {
  for (const change of [
    (input) => (input[3].units[0].population = 0),
    (input) => (input[3].units[0].moves = 0),
    (input) => (input[3].units[0].cost = { unknown: 1 }),
    (input) =>
      (input[1].buildings.find((b) => b.id === "barracks").trains = [
        "unknown",
      ]),
    (input) =>
      (input[1].buildings.find((b) => b.id === "barracks").trainingLimit = 0),
  ]) {
    const input = configs();
    change(input);
    assert.throws(
      () => compileConfiguration(...input),
      /Configuration invalide/,
    );
  }
});
test("units.json est la seule source des unités et ses erreurs sont identifiées", () => {
  for (const file of [undefined, {}, { units: "incorrect" }]) {
    const input = configs();
    input[3] = file;
    assert.throws(() => compileConfiguration(...input), /units.json/);
  }
  const duplicate = configs();
  duplicate[3].units.push(duplicate[3].units[0]);
  assert.throws(() => compileConfiguration(...duplicate), /units.json.*double/);
  const embedded = configs();
  embedded[1].units = embedded[3].units;
  assert.throws(
    () => compileConfiguration(...embedded),
    /uniquement dans units.json/,
  );
});
async function runConfiguredGame(input, body) {
  const root = await mkdtemp(path.join(tmpdir(), "kingbuilder-config-"));
  try {
    await cp(new URL("../dist/", import.meta.url), path.join(root, "dist"), {
      recursive: true,
    });
    await writeFile(path.join(root, "package.json"), '{"type":"module"}');
    const names = [
      "terrain-tiles",
      "buildings",
      "resources",
      "units",
      "game-rules",
      "terrains",
      "missions",
    ];
    for (const [i, name] of names.entries())
      await writeFile(
        path.join(root, "dist", "config", name + ".json"),
        JSON.stringify(input[i]),
      );
    const engine = pathToFileURL(path.join(root, "dist", "engine.js")).href;
    const code = `import assert from 'node:assert/strict';import * as game from ${JSON.stringify(engine)};const engineURL=${JSON.stringify(engine)};${body}`;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", code],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    if (
      path.dirname(root) !== path.resolve(tmpdir()) ||
      !path.basename(root).startsWith("kingbuilder-config-")
    )
      throw Error("Chemin temporaire inattendu.");
    await rm(root, { recursive: true, force: true });
  }
}

test("ajout réel par fichiers : ressources, bâtiments et unités fonctionnent sans éditer le moteur", async () => {
  const input = configs();
  input[2].resources.push({
    id: "gold",
    name: "Or",
    icon: "●",
    startingAmount: 3,
    points: 2,
  });
  input[2].recruitmentCost = { gold: 1 };
  input[0].shapes.push({
    id: "future6",
    name: "Six cases",
    weight: 1,
    pattern: ["xxxxxx"],
  });
  input[0].tiles.push({
    id: "future6-meadow",
    name: "Pré de six",
    shapeId: "future6",
    pattern: ["PPPPPP"],
  });
  input[0].deckSize++;
  input[1].buildings.push({
    id: "mint",
    name: "Atelier monétaire",
    icon: "●",
    weight: 1,
    cost: { gold: 2 },
    terrain: ["plain"],
    layout: ["B"],
    legend: {},
    produces: "gold",
    production: 3,
    description: "3 or par tour.",
    pattern: "Une plaine.",
  });
  input[3].units.push({
    id: "scout",
    name: "Éclaireur",
    icon: "♘",
    cost: { gold: 1 },
    moves: 3,
    population: 1,
    points: 2,
  });
  input[1].buildings.find((b) => b.id === "barracks").trains.push("scout");
  input[1].buildings.find((b) => b.id === "house").housing = 3;
  input[1].buildings.find((b) => b.id === "mill").boost = {
    target: "mint",
    multiplier: 3,
    range: "edge",
    owned: true,
  };
  await runConfiguredGame(
    input,
    `const {createGame,BUILDINGS,RESOURCE_ICONS,score,key,housing,build,assignWorker,endTurn,recruit,placement,UNIT_DEFINITIONS,trainUnit,selectUnit,actor,population}=game;const g=createGame();assert.equal(g.players[0].resources.gold,3);assert.equal(RESOURCE_ICONS.gold,'●');assert.equal(score(g,0).resources,11);assert.equal(housing(g,0),3);assert.ok([...g.tileDeck,...g.tileMarket].some(t=>t.shapeId==='future6'&&t.cells.length===6));assert.ok([...g.buildingDeck,...g.buildingMarket].includes('mint'));g.board[key(1,6)]={terrain:'plain'};g.players[0].x=1;g.buildingMarket[0]='mint';build(g,0,1,6);assert.equal(g.players[0].resources.gold,1);assignWorker(g,0,1,6);g.board[key(2,6)]={terrain:'plain',building:{type:'mill',owner:0}};endTurn(g);assert.equal(g.players[0].resources.gold,10);endTurn(g);recruit(g);assert.equal(g.players[0].resources.gold,9);assert.equal(g.players[0].resources.wheat,1);g.tileMarket[0]=[...g.tileDeck,...g.tileMarket].find(t=>t.shapeId==='future6');assert.equal(placement(g,0,5,5).length,6);g.board[key(4,4)]={terrain:'plain',building:{type:'barracks',owner:0}};const unit=trainUnit(g,4,4,'scout');assert.equal(g.players[0].resources.gold,8);assert.equal(population(g,0),3);assert.equal(score(g,0).units,2);assert.equal(UNIT_DEFINITIONS.scout.name,'Éclaireur');endTurn(g);endTurn(g);selectUnit(g,unit.id);assert.equal(actor(g).moves,3);`,
  );
});
test("la durée et chaque composante du score final suivent game-rules.json", async () => {
  const input = configs();
  input[4] = {
    boardSize: 9,
    turnLimit: 2,
    scoring: {
      tile: 3,
      building: 4,
      worker: 5,
      prestige: 0,
      unit: 2,
      resource: 2,
    },
  };
  input[3].units[0].points = 3;
  await runConfiguredGame(
    input,
    `const g=game.createGame();assert.equal(game.RULES.size,9);assert.equal(game.RULES.rounds,2);assert.deepEqual(g.players.map(p=>[p.x,p.y]),[[0,4],[8,4]]);g.players[0].revealed=2;g.players[0].units.push({id:0,type:'cavalry',x:0,y:4,moves:0,acted:true});assert.deepEqual(game.score(g,0),{tiles:6,buildings:4,workers:5,units:6,prestige:0,resources:10});assert.equal(game.totalScore(g,0),31);for(let i=0;i<3;i++)game.endTurn(g);assert.equal(g.finished,false);game.endTurn(g);assert.equal(g.finished,true);assert.equal(g.round,2);`,
  );
});
test("les limites et les coefficients de score invalides sont refusés", () => {
  for (const change of [
    (c) => (c[4].boardSize = 2),
    (c) => (c[4].turnLimit = 0),
    (c) => (c[4].scoring.worker = -1),
    (c) => delete c[4].scoring.resource,
  ]) {
    const input = configs();
    change(input);
    assert.throws(() => compileConfiguration(...input), /game-rules.json/);
  }
});

test("un nouveau terrain configurable est généré, franchissable et affiché sans modifier le moteur", async () => {
  const input = configs();
  input[5].terrains.push({
    id: "desert",
    name: "Désert",
    icon: "◇",
    walkable: true,
    color: "#d4b572",
    foreground: "#70572b",
  });
  for (const symbol of Object.keys(input[0].legend))
    input[0].legend[symbol] = "desert";
  await runConfiguredGame(
    input,
    `assert.equal(game.TERRAINS.desert.name,'Désert');assert.equal(game.walkable({terrain:'desert'}),true);const g=game.createGame();const tiles=[...g.tileMarket,...g.tileDeck];assert.ok(tiles.every(t=>t.cells.every(c=>c.terrain==='desert')));g.tileMarket[0]=tiles.find(t=>t.shapeId==='line2');game.explore(g,0,1,6);game.endTurn(g);game.endTurn(g);assert.equal(game.move(g,1,6),'moved');const ui=await import(new URL('./ui/html.js',engineURL));const html=ui.terrainDiagram(g.tileMarket[0]);assert.ok(html.includes('#d4b572'));`,
  );
});
test("les propriétés et références des terrains sont validées", () => {
  for (const change of [
    (c) => (c[5].terrains[0].walkable = "oui"),
    (c) => (c[5].terrains[0].color = "url(x)"),
    (c) => (c[0].legend.P = "missing"),
    (c) => (c[1].buildings[0].terrain = ["missing"]),
    (c) => c[5].terrains.push(c[5].terrains[0]),
  ]) {
    const input = configs();
    change(input);
    assert.throws(
      () => compileConfiguration(...input),
      /Configuration invalide/,
    );
  }
});
