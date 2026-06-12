import { describe, expect, it } from "vitest";
import { createTextNode } from "../src/mindmap-model";
import {
  getSelectionAfterReload,
  getSelectionAfterSubtreeRemoval,
  getSelectionUpdate,
  shouldChangeSelectedNode
} from "../src/node-selection";

describe("node selection", () => {
  it("重复选择当前节点时不触发视图更新", () => {
    expect(shouldChangeSelectedNode("node-a", "node-a")).toBe(false);
  });

  it("选择不同节点时触发视图更新", () => {
    expect(shouldChangeSelectedNode("node-a", "node-b")).toBe(true);
  });

  it("方向键停在边界时不触发视图更新", () => {
    expect(getSelectionUpdate("node-a", "node-a")).toEqual({
      changed: false,
      selectedNodeId: "node-a"
    });
  });

  it("方向键移动到不同节点时触发视图更新", () => {
    expect(getSelectionUpdate("node-a", "node-b")).toEqual({
      changed: true,
      selectedNodeId: "node-b"
    });
  });

  it("当前选中节点被移除后回退到触发移除的节点", () => {
    const root = {
      ...createTextNode("root"),
      id: "root",
      children: [{ ...createTextNode("文件节点"), id: "file", children: [] }]
    };

    expect(getSelectionAfterSubtreeRemoval(root, "external", "file")).toBe("file");
    expect(getSelectionAfterSubtreeRemoval(root, "file", "root")).toBe("file");
  });

  it("重新加载后不保留只读预览节点作为快捷键目标", () => {
    const root = {
      ...createTextNode("root"),
      id: "root",
      children: [
        { ...createTextNode("目标"), id: "target", children: [] },
        {
          ...createTextNode("文件节点"),
          id: "file",
          type: "file" as const,
          outlineExpanded: true,
          children: [{ ...createTextNode("外部章节"), id: "external", children: [] }]
        }
      ]
    };

    expect(getSelectionAfterReload(root, "external", undefined, true)).toBe("root");
    expect(getSelectionAfterReload(root, "target", undefined, true)).toBe("target");
    expect(getSelectionAfterReload(root, "missing", "target", true)).toBe("target");
    expect(getSelectionAfterReload(root, "missing", "external", true)).toBe("root");
    expect(getSelectionAfterReload(root, "target", undefined, false)).toBe("root");
  });
});
