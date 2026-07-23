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
    const minimizedSplitRule = getRule(".heading-mindmap-split.is-body-pane-minimized");

    expect(splitRule).toContain("--mindmap-body-pane-height: 55%");
    expect(splitRule).toContain("--mindmap-body-pane-minimized-height: 44px");
    expect(splitRule).toContain("grid-template-rows:");
    expect(splitRule).toContain("var(--mindmap-body-resizer-height)");
    expect(splitRule).toContain("var(--mindmap-body-pane-height)");
    expect(minimizedSplitRule).toContain("var(--mindmap-body-pane-minimized-height)");
    expect(css).toContain(".heading-mindmap-body-resizer");
    expect(css).toContain("cursor: row-resize");
  });

  it("插件不覆盖 Obsidian Markdown 正文排版选择器", () => {
    expect(css).not.toMatch(/\.heading-mindmap-body-preview\s+(h1|h2|h3|p|ul|ol|blockquote|pre|code)\b/);
    expect(css).not.toMatch(/\.markdown-(preview-view|rendered|source-view)\s+(h1|h2|h3|p|ul|ol|blockquote|pre|code)\b/);
    expect(css).not.toMatch(/\.heading-mindmap-body-source\s+\.cm-(line|content)\b/);
  });

  it("导图节点标题完整展示，不用省略号截断", () => {
    const nodeRule = getRule(".heading-mindmap-node");
    const titleRule = getRule(".heading-mindmap-node-title");
    const titleInputRule = getRule(".heading-mindmap-node-title-input");

    expect(nodeRule).toContain("overflow: visible");
    expect(titleRule).toContain("overflow-wrap: anywhere");
    expect(titleRule).toContain("white-space: normal");
    expect(titleRule).toContain("font-variant-numeric: tabular-nums");
    expect(titleRule).not.toContain("text-overflow");
    expect(titleRule).not.toContain("nowrap");
    expect(titleInputRule).toContain("overflow-wrap: anywhere");
    expect(titleInputRule).toContain("white-space: pre-wrap");
    expect(titleInputRule).toContain("font-variant-numeric: tabular-nums");
    expect(css).toContain(".heading-mindmap-node-measure-layer");
    expect(getRule(".heading-mindmap-node-measure-layer")).toContain("visibility: hidden");
  });

  it("移动端工具栏提供可触控的缩放控件，并避免长路径挤压布局", () => {
    const toolbarTitleRule = getRule(".heading-mindmap-toolbar-title");
    const zoomControlsRule = getRule(".heading-mindmap-zoom-controls");
    const zoomLabelRule = getRule(".heading-mindmap-zoom-label");
    const scrollAreaRule = getRule(".heading-mindmap-scroll-area");

    expect(toolbarTitleRule).toContain("min-width: 0");
    expect(scrollAreaRule).toContain("overflow: hidden");
    expect(zoomControlsRule).toContain("display: inline-flex");
    expect(zoomControlsRule).toContain("border-radius: 8px");
    expect(zoomLabelRule).toContain("font-variant-numeric: tabular-nums");
    expect(css).toContain(".heading-mindmap-toolbar-actions button");
    expect(css).toContain("height: 44px");
    expect(css).toContain("width: 44px");
    expect(css).toContain("flex-wrap: wrap");
  });
});
