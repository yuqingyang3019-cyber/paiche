import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "..", "agent", "static");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const name of ["index.html", "app.js", "style.css"]) {
  await cp(join(root, "src", name), join(out, name));
}

console.log("built -> agent/static");
