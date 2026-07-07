import { describe, expect, it } from "vitest";
import { createTextNode, type MindNode } from "../src/mindmap-model";
import { dispatchMindmapShortcut } from "../src/mindmap-shortcut-dispatch";
import type { OperationResult } from "../src/mindmap-operations";

function node(id: string, title = id, children: MindNode[] = []): MindNode {
  return {
    ...createTextNode(title),
    id,
    children
  };
}

function shortcutEvent(key: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent & { prevented: boolean } {
  return {
    key,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
    ...options
  } as KeyboardEvent & { prevented: boolean };
}

describe("mindmap shortcut dispatch", () => {
  it("方向键选择节点并聚焦画布", () => {
    const root = node("root", "root", [node("a"), node("b")]);
    const selected: string[] = [];
    let focused = 0;
    const event = shortcutEvent("ArrowDown");

    const handled = dispatchMindmapShortcut(event, {
      root,
      selectedNodeId: "a",
      onOperation: () => undefined,
      onSelectNode: (nodeId) => selected.push(nodeId),
      onFocusCanvas: () => {
        focused += 1;
      },
      onFocusBody: () => undefined,
      onStartTitleEdit: () => undefined
    });

    expect(handled).toBe(true);
    expect(event.prevented).toBe(true);
    expect(selected).toEqual(["b"]);
    expect(focused).toBe(1);
  });

  it("Tab 分发为新增子节点操作", () => {
    const root = node("root", "root", [node("a")]);
    const operations: OperationResult[] = [];
    const event = shortcutEvent("Tab");

    dispatchMindmapShortcut(event, {
      root,
      selectedNodeId: "a",
      onOperation: (result) => operations.push(result),
      onSelectNode: () => undefined,
      onFocusCanvas: () => undefined,
      onFocusBody: () => undefined,
      onStartTitleEdit: () => undefined
    });

    expect(operations[0]).toMatchObject({ ok: true });
    expect(root.children[0].children[0].title).toBe("新节点");
  });

  it("Ctrl Enter 分发为聚焦正文", () => {
    let focusBody = 0;
    const event = shortcutEvent("Enter", { ctrlKey: true });

    dispatchMindmapShortcut(event, {
      root: node("root"),
      selectedNodeId: "root",
      onOperation: () => undefined,
      onSelectNode: () => undefined,
      onFocusCanvas: () => undefined,
      onFocusBody: () => {
        focusBody += 1;
      },
      onStartTitleEdit: () => undefined
    });

    expect(focusBody).toBe(1);
    expect(event.prevented).toBe(true);
  });

  it("非导图快捷键返回未处理", () => {
    const event = shortcutEvent("x");

    expect(dispatchMindmapShortcut(event, {
      root: node("root"),
      selectedNodeId: "root",
      onOperation: () => undefined,
      onSelectNode: () => undefined,
      onFocusCanvas: () => undefined,
      onFocusBody: () => undefined,
      onStartTitleEdit: () => undefined
    })).toBe(false);
    expect(event.prevented).toBe(false);
  });
});
