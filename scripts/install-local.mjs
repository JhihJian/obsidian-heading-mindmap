import { access, copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const vaultPath = "C:\\Users\\user\\Nutstore\\1\\0-obsidian-diary";
const pluginDir = resolve(vaultPath, ".obsidian", "plugins", "heading-mindmap");
const pluginFiles = ["main.js", "manifest.json", "styles.css"];

try {
  await access(vaultPath);
} catch {
  console.error(`Obsidian vault path does not exist: ${vaultPath}`);
  process.exit(1);
}

await mkdir(pluginDir, { recursive: true });

for (const file of pluginFiles) {
  await copyFile(resolve(file), resolve(pluginDir, file));
}

console.log(`Installed Heading Mindmap to ${pluginDir}`);
