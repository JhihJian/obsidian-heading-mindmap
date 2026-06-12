import { describe, expect, it } from "vitest";
import { createTextNode, type MindNode } from "../src/mindmap-model";
import { getDirectionalNodeId } from "../src/mindmap-navigation";

function node(id: string, title = id, children: MindNode[] = []): MindNode {
  return {
    ...createTextNode(title),
    id,
    children
  };
}

describe("getDirectionalNodeId", () => {
  const root = node("root", "root", [
    node("a"),
    node("b", "b", [
      node("b1"),
      node("b2")
    ]),
    node("c")
  ]);

  it("用左右方向在父子节点之间移动", () => {
    expect(getDirectionalNodeId(root, "root", "right")).toBe("a");
    expect(getDirectionalNodeId(root, "b", "right")).toBe("b1");
    expect(getDirectionalNodeId(root, "b1", "left")).toBe("b");
    expect(getDirectionalNodeId(root, "root", "left")).toBe("root");
  });

  it("用上下方向在同级节点之间移动", () => {
    expect(getDirectionalNodeId(root, "root", "down")).toBe("root");
    expect(getDirectionalNodeId(root, "a", "down")).toBe("b");
    expect(getDirectionalNodeId(root, "b", "down")).toBe("c");
    expect(getDirectionalNodeId(root, "b1", "down")).toBe("b2");
    expect(getDirectionalNodeId(root, "b2", "down")).toBe("b2");
    expect(getDirectionalNodeId(root, "a", "up")).toBe("a");
    expect(getDirectionalNodeId(root, "root", "up")).toBe("root");
  });

  it("子树折叠后右方向不会进入隐藏子节点", () => {
    const collapsed = node("root", "root", [
      node("a"),
      { ...node("b", "b", [node("b1")]), childrenCollapsed: true }
    ]);

    expect(getDirectionalNodeId(collapsed, "b", "right")).toBe("b");
  });
});
