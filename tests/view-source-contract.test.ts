import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync("src/main.ts", "utf8");

function getMethodBody(methodName: string): string {
  const start = mainSource.search(new RegExp(`^\\s*(?:private\\s+)?(?:async\\s+)?${methodName}\\b`, "m"));
  if (start < 0) throw new Error(`找不到方法：${methodName}`);

  const signatureEnd = mainSource.indexOf("):", start);
  const braceStart = mainSource.indexOf("{", signatureEnd);
  if (braceStart < 0) throw new Error(`找不到方法体：${methodName}`);

  let depth = 0;
  for (let index = braceStart; index < mainSource.length; index += 1) {
    const char = mainSource[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return mainSource.slice(braceStart + 1, index);
  }

  throw new Error(`方法体未闭合：${methodName}`);
}

describe("view source contract", () => {
  it("导图节点只渲染标题和类型标识，不在节点内放按钮或正文", () => {
    const renderNode = getMethodBody("renderNode");

    expect(renderNode).not.toContain("ButtonComponent");
    expect(renderNode).not.toContain('createEl("button"');
    expect(renderNode).not.toContain("node.body");
    expect(renderNode).toContain("node.title");
    expect(renderNode).toContain("getNodeBadge");
  });

  it("正文区右上角保留阅读/编辑切换按钮，导图工具栏承载视图级操作", () => {
    const renderBodyPane = getMethodBody("renderBodyPane");
    const createToolbar = getMethodBody("createToolbar");

    expect(renderBodyPane).toContain("new ButtonComponent(actions)");
    expect(renderBodyPane).toContain("toggleBodyPaneMode");
    expect(createToolbar).toContain("new ButtonComponent(actions)");
    expect(createToolbar).toContain("openFilePicker");
  });

  it("视图打开时区分等待 leaf state 和激活默认导图，避免空 state 重复打开视图", () => {
    const loadFromState = getMethodBody("loadFromState");
    const onOpen = getMethodBody("onOpen");

    expect(mainSource).toContain("decideMindmapStateLoadPolicy");
    expect(loadFromState).toContain("policy === \"await-state\"");
    expect(loadFromState).toContain("policy === \"activate-default\"");
    expect(loadFromState).not.toContain("if (!this.filePath)");
    expect(onOpen).not.toContain("loadFromState");
  });
});
