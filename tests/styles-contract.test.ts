import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("styles.css", "utf8");

function getRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "m"));
  if (!match?.groups?.body) throw new Error(`找不到 CSS 规则：${selector}`);
  return match.groups.body;
}

describe("styles contract", () => {
  it("上下分屏中正文区域不小于导图区，保证正文可读可编辑", () => {
    const splitRule = getRule(".outline-mindmap-split");

    expect(splitRule).toContain("grid-template-rows: minmax(220px, 45%) minmax(320px, 55%)");
  });

  it("插件不覆盖 Obsidian Markdown 正文排版选择器", () => {
    expect(css).not.toMatch(/\.outline-mindmap-body-preview\s+(h1|h2|h3|p|ul|ol|blockquote|pre|code)\b/);
    expect(css).not.toMatch(/\.markdown-(preview-view|rendered|source-view)\s+(h1|h2|h3|p|ul|ol|blockquote|pre|code)\b/);
    expect(css).not.toMatch(/\.outline-mindmap-body-source\s+\.cm-(line|content)\b/);
  });
});
