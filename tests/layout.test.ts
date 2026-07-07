import { describe, expect, it } from "vitest";
import { createTextNode, type MindNode } from "../src/mindmap-model";
import { layoutMindmap } from "../src/tree-layout";

describe("layoutMindmap", () => {
  it("把子节点放在父节点右侧，并让父节点垂直居中于子树", () => {
    const root: MindNode = {
      ...createTextNode("root"),
      id: "root",
      children: [
        { ...createTextNode("a"), id: "a" },
        {
          ...createTextNode("b"),
          id: "b",
          children: [
            { ...createTextNode("b1"), id: "b1" },
            { ...createTextNode("b2"), id: "b2" }
          ]
        }
      ]
    };

    const layout = layoutMindmap(root);
    const positions = Object.fromEntries(layout.nodes.map((node) => [node.id, node]));

    expect(positions.a.x).toBeGreaterThan(positions.root.x);
    expect(positions.a.x).toBeGreaterThan(positions.root.x + positions.root.width);
    expect(positions.b1.x).toBeGreaterThan(positions.b.x);
    expect(positions.b1.x).toBeGreaterThan(positions.b.x + positions.b.width);
    expect(positions.b.y + positions.b.height / 2).toBe(
      (positions.b1.y + positions.b1.height / 2 + positions.b2.y + positions.b2.height / 2) / 2
    );
    expect(layout.width).toBeGreaterThan(positions.b1.x);
    expect(layout.height).toBeGreaterThan(positions.b2.y);
  });

  it("布局时隐藏已折叠的子树", () => {
    const root: MindNode = {
      ...createTextNode("root"),
      id: "root",
      childrenCollapsed: true,
      children: [
        { ...createTextNode("a"), id: "a" },
        { ...createTextNode("b"), id: "b" }
      ]
    };

    const layout = layoutMindmap(root);

    expect(layout.nodes.map((node) => node.id)).toEqual(["root"]);
    expect(layout.edges).toEqual([]);
  });

  it("长标题节点按内容扩展尺寸，并为后续节点预留空间", () => {
    const root: MindNode = {
      ...createTextNode("root"),
      id: "root",
      children: [
        {
          ...createTextNode("这是一个很长的导图节点标题，需要完整换行展示而不是在中间被省略"),
          id: "long"
        },
        { ...createTextNode("short"), id: "short" }
      ]
    };

    const layout = layoutMindmap(root);
    const positions = Object.fromEntries(layout.nodes.map((node) => [node.id, node]));

    expect(positions.long.width).toBeGreaterThan(positions.short.width);
    expect(positions.long.height).toBeGreaterThan(positions.short.height);
    expect(positions.short.y).toBeGreaterThanOrEqual(positions.long.y + positions.long.height + 40);
  });
});
