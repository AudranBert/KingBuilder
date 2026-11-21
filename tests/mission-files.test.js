import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MISSION_CONFIGURATION } from "../src/configuration.js";

const directory = new URL("../config/missions/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", directory), "utf8"));

test("chaque catégorie regroupe ses trois niveaux dans un fichier indexé", async () => {
  assert.deepEqual((await readdir(directory)).sort(), [...index.files.map(name => `${name}.json`), "index.json"].sort());
  const missions = [];
  for (const family of index.files) {
    const group = JSON.parse(await readFile(new URL(`${family}.json`, directory), "utf8"));
    assert.deepEqual(group.map(m => m.difficulty), [1, 2, 3]);
    assert.ok(group.every(m => m.family === family));
    assert.ok(group.every(m => ["metric", "terrain", "building", "resource"].every(key => m[key] === group[0][key])));
    assert.ok(group[0].target < group[1].target && group[1].target < group[2].target);
    missions.push(...group);
  }
  assert.deepEqual(MISSION_CONFIGURATION.missions, missions);
  assert.deepEqual(missions.filter(m => m.family === "revealed-mountain").map(m => m.target), [3, 6, 9]);
});

test("le chargement refuse un index invalide, un fichier absent et une mission dans la mauvaise catégorie", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kingbuilder-mission-files-"));
  try {
    for (const folder of ["src", "config"])
      await cp(new URL(`../${folder}/`, import.meta.url), path.join(root, folder), { recursive: true });
    await writeFile(path.join(root, "package.json"), '{"type":"module"}');
    const indexPath = path.join(root, "config/missions/index.json");
    let version = 0;
    const load = () => import(`${pathToFileURL(path.join(root, "src/configuration.js"))}?test=${version++}`);
    for (const files of [[], ["revealed-all", "revealed-all"], ["../missions"], "revealed-all"]) {
      await writeFile(indexPath, JSON.stringify({ ...index, files }));
      await assert.rejects(load(), /Index des missions invalide/);
    }
    await writeFile(indexPath, JSON.stringify({ ...index, files: ["missing"] }));
    await assert.rejects(load(), /missions\/missing.json/);
    await writeFile(indexPath, JSON.stringify(index));
    const groupPath = path.join(root, "config/missions/revealed-mountain.json");
    const group = JSON.parse(await readFile(groupPath, "utf8"));
    group[0].family = "revealed-forest";
    await writeFile(groupPath, JSON.stringify(group));
    await assert.rejects(load(), /Catégorie de missions invalide.*revealed-mountain.json/);
  } finally {
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("kingbuilder-mission-files-"))
      throw Error("Chemin temporaire inattendu");
    await rm(resolved, { recursive: true, force: true });
  }
});
