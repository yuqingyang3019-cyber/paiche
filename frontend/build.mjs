import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outputs = [
  join(root, "..", "agent", "static"),
  join(root, "..", "dist", "h5"),
];
const apiBase = process.env.PAICHE_API_BASE || "";

for (const out of outputs) {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  for (const name of ["index.html", "app.js", "style.css"]) {
    await cp(join(root, "src", name), join(out, name));
  }

  await writeFile(
    join(out, "config.js"),
    `window.__PAICHE_CONFIG__ = ${JSON.stringify({ apiBase }, null, 2)};\n`,
    "utf8"
  );
}

console.log(`built -> ${outputs.join(", ")}`);
