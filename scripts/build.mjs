import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(projectRoot, "dist");

export async function build() {
  // Only the generated directory belonging to this project may be cleaned.
  if (path.dirname(destination) !== path.resolve(projectRoot) || path.basename(destination) !== "dist") {
    throw Error("Dossier de génération inattendu.");
  }
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(path.join(projectRoot, "public"), destination, { recursive: true });
  for (const directory of ["src", "assets", "config"]) {
    await cp(path.join(projectRoot, directory), path.join(destination, directory), { recursive: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
  console.log("Site généré dans dist/.");
}
