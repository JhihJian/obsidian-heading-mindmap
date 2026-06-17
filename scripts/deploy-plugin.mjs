import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const vaultPath = process.argv[2];

if (!vaultPath) {
  console.error("Usage: node scripts/deploy-plugin.mjs <obsidian-vault-path>");
  process.exit(1);
}

const pluginDir = resolve(vaultPath, ".obsidian", "plugins", "heading-mindmap");
await mkdir(pluginDir, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  await copyFile(resolve(file), resolve(pluginDir, file));
}

console.log(`Deployed Heading Mindmap Prototype to ${pluginDir}`);
