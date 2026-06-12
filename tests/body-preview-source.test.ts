import { describe, expect, it } from "vitest";
import { getBodyPreviewSourcePath } from "../src/body-preview-source";
import { createFileNode, createTextNode } from "../src/mindmap-model";

describe("body preview source path", () => {
  it("普通节点使用当前导图文件作为 Markdown 渲染来源", () => {
    const node = createTextNode("目标", "[[相对链接]]");

    expect(getBodyPreviewSourcePath(node, "maps/product.md")).toBe("maps/product.md");
  });

  it("跨文件大纲节点使用目标文件作为 Markdown 渲染来源", () => {
    const node = createTextNode("外部标题", "[[相对链接]]");
    node.filePath = "notes/project.md";

    expect(getBodyPreviewSourcePath(node, "maps/product.md")).toBe("notes/project.md");
  });

  it("文件节点使用目标文件作为 Markdown 渲染来源", () => {
    const node = createFileNode("notes/project.md");

    expect(getBodyPreviewSourcePath(node, "maps/product.md")).toBe("notes/project.md");
  });
});
