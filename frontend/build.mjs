import { cp, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { get } from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "..", "agent", "static");
const vueUrl = "https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.esm-browser.js";
const vueTarget = join(out, "assets", "vue.esm-browser.js");

async function download(url, target) {
  await mkdir(dirname(target), { recursive: true });
  await new Promise((resolve, reject) => {
    get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`download failed: ${response.statusCode}`));
        return;
      }
      const file = createWriteStream(target);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    }).on("error", reject);
  });
}

await mkdir(join(out, "assets"), { recursive: true });
try {
  await cp(vueTarget, vueTarget + ".bak");
} catch {
  /* first build */
}
try {
  await download(vueUrl, vueTarget);
} catch {
  await cp(vueTarget + ".bak", vueTarget);
}

for (const name of ["index.html", "app.js", "style.css"]) {
  await cp(join(root, "src", name), join(out, name));
}
await cp(join(root, "src", "modules"), join(out, "modules"), { recursive: true });

console.log("built -> agent/static");
