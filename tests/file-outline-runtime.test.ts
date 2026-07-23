import { describe, expect, it } from "vitest";
import { createFileNode, createTextNode, type MindNode } from "../src/mindmap-model";
import {
  expandFileOutlineNode,
  findExpandedFileNode,
  refreshExpandedFileOutline
} from "../src/file-outline-runtime";

function rootWithFile(fileNode: MindNode): MindNode {
  return {
    ...createTextNode("root"),
    id: "root",
    type: "document",
    children: [fileNode]
  };
}

describe("file outline runtime", () => {
  it("查找已展开并解析到目标路径的文件节点", () => {
    const fileNode = { ...createFileNode("notes/target.md"), outlineExpanded: true };
    const root = rootWithFile(fileNode);

    expect(findExpandedFileNode(root, "notes/target.md", (node) => ({ path: node.filePath ?? "" }))).toBe(fileNode);
  });

  it("刷新已展开文件节点的大纲子节点", async () => {
    const fileNode = { ...createFileNode("notes/target.md"), outlineExpanded: true };
    const root = rootWithFile(fileNode);

    const refreshed = await refreshExpandedFileOutline(
      root,
      { path: "notes/target.md" },
      (node) => ({ path: node.filePath ?? "" }),
      () => Promise.resolve(["# 目标", "", "## 子目标"].join("\n"))
    );

    expect(refreshed).toBe(true);
    expect(fileNode.children.map((node) => node.title)).toEqual(["目标"]);
    expect(fileNode.children[0].children.map((node) => node.title)).toEqual(["子目标"]);
  });

  it("展开文件节点时只挂载目标文件标题，不重复挂载目标文件根节点", async () => {
    const fileNode = createFileNode("notes/target.md");
    const root = rootWithFile(fileNode);

    await expandFileOutlineNode(
      fileNode,
      () => ({ path: "notes/target.md" }),
      () => Promise.resolve(["# 目标", "", "## 子目标"].join("\n"))
    );

    expect(root.children).toEqual([fileNode]);
    expect(fileNode.children.map((node) => node.title)).toEqual(["目标"]);
    expect(fileNode.children[0].children.map((node) => node.title)).toEqual(["子目标"]);
    expect(fileNode.children.some((node) => node.type === "document" || node.title === "target")).toBe(false);
  });

  it("展开文件节点时读取目标文件并返回空大纲状态", async () => {
    const fileNode = createFileNode("notes/empty.md");

    const result = await expandFileOutlineNode(
      fileNode,
      () => ({ path: "notes/empty.md" }),
      () => Promise.resolve("没有标题的正文")
    );

    expect(result).toEqual({ ok: true, empty: true });
    expect(fileNode.outlineExpanded).toBe(true);
    expect(fileNode.children).toEqual([]);
  });

  it("缺少文件路径时返回明确失败", async () => {
    const result = await expandFileOutlineNode(
      { ...createFileNode("notes/missing.md"), filePath: undefined },
      () => null,
      () => Promise.resolve("")
    );

    expect(result).toEqual({ ok: false, message: "此文件节点缺少文件路径。" });
  });
});
