import { describe, expect, it } from "vitest";
import { MINDMAP_SHORTCUT_HELP } from "../src/mindmap-shortcut-help";

describe("mindmap shortcut help", () => {
  it("覆盖导图快捷键并保持按键描述唯一", () => {
    expect(MINDMAP_SHORTCUT_HELP.length).toBeGreaterThanOrEqual(10);
    expect(new Set(MINDMAP_SHORTCUT_HELP.map((item) => item.keys)).size).toBe(MINDMAP_SHORTCUT_HELP.length);
    expect(MINDMAP_SHORTCUT_HELP).toContainEqual({ keys: "Ctrl/Cmd + Enter", action: "聚焦正文编辑区" });
    expect(MINDMAP_SHORTCUT_HELP).toContainEqual({ keys: "Shift + Tab", action: "升级当前节点" });
  });
});
