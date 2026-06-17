import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Manifest = {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
  authorUrl: string;
  isDesktopOnly: boolean;
};

const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as Manifest;
const versions = JSON.parse(readFileSync("versions.json", "utf8")) as Record<string, string>;

describe("community release contract", () => {
  it("manifest 满足 Obsidian 社区插件目录的基础发布字段", () => {
    expect(manifest).toMatchObject({
      id: "heading-mindmap",
      name: "Heading Mindmap",
      author: "JhihJian",
      authorUrl: "https://github.com/JhihJian",
      isDesktopOnly: false
    });
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.minAppVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.id).not.toContain("obsidian");
    expect(manifest.description.length).toBeLessThanOrEqual(250);
    expect(manifest.description).toMatch(/\.$/);
  });

  it("versions.json 包含当前版本和最低 Obsidian 版本映射", () => {
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
  });

  it("仓库包含官方目录提交所需的根目录文件", () => {
    expect(existsSync("README.md")).toBe(true);
    expect(existsSync("LICENSE")).toBe(true);
    expect(existsSync("manifest.json")).toBe(true);
  });

  it("插件命令 ID 不重复包含插件 ID", () => {
    const source = readFileSync("src/main.ts", "utf8");

    expect(source).toContain('id: "open"');
    expect(source).not.toContain('id: "open-heading-mindmap"');
  });

  it("GitHub Release workflow 会构建并上传 Obsidian 安装资产", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");

    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("main.js manifest.json styles.css");
  });
});
