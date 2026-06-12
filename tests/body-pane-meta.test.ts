import { describe, expect, it } from "vitest";
import { getBodyPaneMeta } from "../src/body-pane-meta";
import { createFileNode, createTextNode } from "../src/mindmap-model";

describe("body pane meta", () => {
  it("普通节点显示当前导图文件路径", () => {
    const node = createTextNode("目标");

    expect(getBodyPaneMeta(node, { currentFilePath: "maps/product.md", readonly: false })).toBe("maps/product.md");
  });

  it("文件节点显示目标 Markdown 文件路径", () => {
    const node = createFileNode("notes/project.md");

    expect(getBodyPaneMeta(node, { currentFilePath: "maps/product.md", readonly: false })).toBe("notes/project.md");
  });

  it("跨文件大纲只读节点显示只读状态和来源文件路径", () => {
    const node = createTextNode("外部标题");
    node.filePath = "notes/project.md";

    expect(getBodyPaneMeta(node, { currentFilePath: "maps/product.md", readonly: true })).toBe(
      "只读预览 · notes/project.md"
    );
  });

  it("列表项虚拟节点显示列表项预览", () => {
    const node = createTextNode("目标一");
    node.type = "list-item";
    node.virtual = true;

    expect(getBodyPaneMeta(node, { currentFilePath: "maps/product.md", readonly: true })).toBe("正文列表项预览");
  });
});
