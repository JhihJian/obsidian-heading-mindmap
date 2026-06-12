import { describe, expect, it } from "vitest";
import {
  getMindmapShortcutAction,
  shouldHandleDocumentShortcutTarget,
  shouldIgnoreMindmapShortcutTarget
} from "../src/keyboard-shortcuts";

describe("mindmap keyboard shortcuts", () => {
  it("按 PRD 把键盘输入映射为导图操作意图", () => {
    expect(getMindmapShortcutAction({ key: "ArrowUp", altKey: true })).toEqual({ type: "move-sibling", direction: "up" });
    expect(getMindmapShortcutAction({ key: "ArrowDown", altKey: true })).toEqual({ type: "move-sibling", direction: "down" });
    expect(getMindmapShortcutAction({ key: "ArrowUp" })).toEqual({ type: "select", direction: "up" });
    expect(getMindmapShortcutAction({ key: "ArrowDown" })).toEqual({ type: "select", direction: "down" });
    expect(getMindmapShortcutAction({ key: "ArrowLeft" })).toEqual({ type: "select", direction: "left" });
    expect(getMindmapShortcutAction({ key: "ArrowRight" })).toEqual({ type: "select", direction: "right" });
    expect(getMindmapShortcutAction({ key: "Enter" })).toEqual({ type: "edit-title" });
    expect(getMindmapShortcutAction({ key: "Enter", ctrlKey: true })).toEqual({ type: "focus-body" });
    expect(getMindmapShortcutAction({ key: "Enter", metaKey: true })).toEqual({ type: "focus-body" });
    expect(getMindmapShortcutAction({ key: "Tab" })).toEqual({ type: "add-child" });
    expect(getMindmapShortcutAction({ key: "Enter", shiftKey: true })).toEqual({ type: "add-sibling" });
    expect(getMindmapShortcutAction({ key: "Tab", shiftKey: true })).toEqual({ type: "promote" });
    expect(getMindmapShortcutAction({ key: " " })).toEqual({ type: "toggle-fold" });
    expect(getMindmapShortcutAction({ key: "Delete" })).toEqual({ type: "delete" });
  });

  it("正文源码编辑器、输入框和可编辑内容不触发导图快捷键", () => {
    expect(shouldIgnoreMindmapShortcutTarget({ isEditableElement: true })).toBe(true);
    expect(shouldIgnoreMindmapShortcutTarget({ isContentEditable: true })).toBe(true);
    expect(shouldIgnoreMindmapShortcutTarget({ insideSourceEditor: true })).toBe(true);
    expect(shouldIgnoreMindmapShortcutTarget({})).toBe(false);
  });

  it("按钮、链接和可点击控件不触发导图快捷键", () => {
    expect(shouldIgnoreMindmapShortcutTarget({ isInteractiveElement: true })).toBe(true);
  });

  it("普通可聚焦导图节点仍允许触发导图快捷键", () => {
    expect(shouldIgnoreMindmapShortcutTarget({})).toBe(false);
  });

  it("视图内任意非编辑区域都允许 document 级兜底快捷键连续生效", () => {
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: true,
        targetInsideModal: false,
        activeViewIsMindmap: true,
        activeElementIsPageRoot: false
      })
    ).toBe(true);
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: false,
        targetInsideModal: false,
        activeViewIsMindmap: true,
        activeElementIsPageRoot: true
      })
    ).toBe(true);
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: false,
        targetInsideModal: true,
        activeViewIsMindmap: true,
        activeElementIsPageRoot: true
      })
    ).toBe(false);
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: false,
        targetInsideModal: false,
        activeViewIsMindmap: false,
        activeElementIsPageRoot: true
      })
    ).toBe(false);
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: true,
        targetInsideModal: false,
        activeViewIsMindmap: false,
        activeElementIsPageRoot: false
      })
    ).toBe(false);
  });
});
