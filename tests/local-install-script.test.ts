import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("local install script", () => {
  it("固定安装到本机 Obsidian 日记库并复制插件运行文件", () => {
    const source = readFileSync("scripts/install-local.mjs", "utf8");

    expect(source).toContain("C:\\\\Users\\\\user\\\\Nutstore\\\\1\\\\0-obsidian-diary");
    expect(source).toContain('".obsidian", "plugins", "heading-mindmap"');
    expect(source).toContain('"main.js", "manifest.json", "styles.css"');
  });

  it("package.json 提供本机安装命令", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["install:local"]).toBe("npm run build && node scripts/install-local.mjs");
  });
});
