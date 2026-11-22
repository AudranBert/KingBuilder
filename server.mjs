import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./scripts/build.mjs";

await build();
const root = fileURLToPath(new URL("./dist", import.meta.url));
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const file = path.resolve(
        root,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const data = await readFile(file);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".js": "text/javascript",
          ".json": "application/json; charset=utf-8",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.writeHead(404).end("Introuvable");
    }
  })
  .on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        "Le port 4173 est déjà occupé. Si KingBuilder y tourne déjà, ouvrez http://127.0.0.1:4173/ et utilisez npm run build pour actualiser le site. Sinon, arrêtez le processus qui occupe ce port avant de relancer npm start.",
      );
    } else {
      console.error("Impossible de démarrer KingBuilder :", error.message);
    }
    process.exitCode = 1;
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("KingBuilder : http://127.0.0.1:4173"),
  );
