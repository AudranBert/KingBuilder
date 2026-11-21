import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TERRAIN_TILE_CONFIGURATION } from "../src/configuration.js";

const directory = new URL("../config/terrain-tiles/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", directory), "utf8"));

test("chaque fichier contient les formes et tuiles de sa taille, sans perte au chargement", async () => {
  assert.deepEqual((await readdir(directory)).filter(name => name.endsWith(".json")).sort(), [...index.files.map(size => `${size}.json`), "index.json"].sort());
  const shapes = [], tiles = [];
  for (const size of index.files) {
    const group = JSON.parse(await readFile(new URL(`${size}.json`, directory), "utf8"));
    for (const entry of [...group.shapes, ...group.tiles])
      assert.equal(entry.pattern.join('').replaceAll('.', '').length, Number(size));
    assert.ok(group.tiles.every(tile => group.shapes.some(shape => shape.id === tile.shapeId)));
    shapes.push(...group.shapes);
    tiles.push(...group.tiles);
  }
  assert.deepEqual(TERRAIN_TILE_CONFIGURATION.shapes, shapes);
  assert.deepEqual(TERRAIN_TILE_CONFIGURATION.tiles, tiles);
});

test("le chargement refuse un index invalide et les tuiles de mauvaise taille ou forme", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kingbuilder-tile-files-"));
  try {
    for (const folder of ["src", "config"])
      await cp(new URL(`../${folder}/`, import.meta.url), path.join(root, folder), { recursive: true });
    await writeFile(path.join(root, "package.json"), '{"type":"module"}');
    const indexPath = path.join(root, "config/terrain-tiles/index.json");
    let version = 0;
    const load = () => import(`${pathToFileURL(path.join(root, "src/configuration.js"))}?test=${version++}`);
    for (const files of [[], ["2", "2"], ["../2"], [2], ["02"]]) {
      await writeFile(indexPath, JSON.stringify({ ...index, files }));
      await assert.rejects(load(), /Index des tuiles de terrain invalide/);
    }
    await writeFile(indexPath, JSON.stringify(index));
    const groupPath = path.join(root, "config/terrain-tiles/2.json");
    const original = JSON.parse(await readFile(groupPath, "utf8"));
    for (const change of [g => g.tiles[0].pattern = ["PPP"], g => g.shapes[0].pattern = ["xxx"], g => g.tiles[0].shapeId = "line3"]) {
      const group = structuredClone(original);
      change(group);
      await writeFile(groupPath, JSON.stringify(group));
      await assert.rejects(load(), /Taille ou forme de tuile invalide.*2.json/);
    }
  } finally {
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("kingbuilder-tile-files-"))
      throw Error("Chemin temporaire inattendu");
    await rm(resolved, { recursive: true, force: true });
  }
});
