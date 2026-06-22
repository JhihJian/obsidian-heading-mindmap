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
  it("上下分屏中正文区域高度由可拖拽变量控制，并保留可读可编辑下限", () => {
    const splitRule = getRule(".heading-mindmap-split");

    expect(splitRule).toContain("--mindmap-body-pane-height: 55%");
    expect(splitRule).toContain("grid-template-rows:");
    expect(splitRule).toContain("var(--mindmap-body-resizer-height)");
    expect(splitRule).toContain("var(--mindmap-body-pane-height)");
    expect(css).toContain(".heading-mindmap-body-resizer");
    expect(css).toContain("cursor: row-resize");
  });

  it("插件不覆盖 Obsidian Markdown 正文排版选择器", () => {
    expect(css).not.toMatch(/\.heading-mindmap-body-preview\s+(h1|h2|h3|p|ul|ol|blockquote|pre|code)\b/);
    expect(css).not.toMatch(/\.markdown-(preview-view|rendered|source-view)\s+(h1|h2|h3|p|ul|ol|blockquote|pre|code)\b/);
    expect(css).not.toMatch(/\.heading-mindmap-body-source\s+\.cm-(line|content)\b/);
  });
});
