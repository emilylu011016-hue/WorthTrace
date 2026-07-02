import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "mobile", "pwa");
const output = path.join(root, "dist-mobile");
const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "logo-qianji-a.svg",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

for (const file of requiredFiles) {
  await stat(path.join(output, file));
}

console.log(`WorthTrace mobile PWA built: ${path.relative(root, output)}`);
