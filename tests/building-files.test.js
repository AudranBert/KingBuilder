import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BUILDING_CONFIGURATION } from "../src/configuration.js";

const directory = new URL("../config/buildings/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", directory), "utf8"));

test("chaque famille et toutes ses variantes sont regroupées dans un fichier indexé", async () => {
  const files = (await readdir(directory)).filter(name => name.endsWith(".json") && name !== "index.json");
  assert.deepEqual(files.sort(), index.files.map(name => `${name}.json`).sort());
  const entries = [];
  for (const family of index.files) {
    const group = JSON.parse(await readFile(new URL(`${family}.json`, directory), "utf8"));
    assert.equal(group.filter(b => b.id === family && !b.family).length, 1);
    assert.ok(group.every(b => (b.family || b.id) === family));
    entries.push(...group);
  }
  assert.deepEqual(BUILDING_CONFIGURATION.buildings, entries);
  assert.equal(new Set(entries.map(b => b.id)).size, entries.length);
});

test("le chargement refuse un index invalide, un fichier manquant et une variante dans la mauvaise famille", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kingbuilder-building-files-"));
  try {
    for (const folder of ["src", "config"])
      await cp(new URL(`../${folder}/`, import.meta.url), path.join(root, folder), { recursive: true });
    await writeFile(path.join(root, "package.json"), '{"type":"module"}');
    const indexPath = path.join(root, "config/buildings/index.json");
    let version = 0;
    const load = () => import(`${pathToFileURL(path.join(root, "src/configuration.js"))}?version=${version++}`);
    for (const files of [[], ["house", "house"], ["../house"], "house"] ) {
      await writeFile(indexPath, JSON.stringify({ ...index, files }));
      await assert.rejects(load(), /Index des bâtiments invalide/);
    }
    await writeFile(indexPath, JSON.stringify({ ...index, files: ["missing"] }));
    await assert.rejects(load(), /buildings\/missing.json/);
    await writeFile(indexPath, JSON.stringify(index));
    const housePath = path.join(root, "config/buildings/house.json");
    const house = JSON.parse(await readFile(housePath, "utf8"));
    house.push({ ...house[0], id: "misplaced", family: "farm" });
    await writeFile(housePath, JSON.stringify(house));
    await assert.rejects(load(), /Famille de bâtiments invalide.*house.json/);
  } finally {
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("kingbuilder-building-files-"))
      throw Error("Chemin temporaire inattendu");
    await rm(resolved, { recursive: true, force: true });
  }
});
