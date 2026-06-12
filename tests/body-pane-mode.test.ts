import { describe, expect, it } from "vitest";
import {
  isLatestBodyPaneModeRequest,
  nextBodyPaneModeRequestId,
  normalizeBodyPaneMode,
  shouldRenderBodyPaneMode,
  shouldSaveBodyBeforeModeChange,
  toggleBodyPaneMode
} from "../src/body-pane-mode";

describe("body pane mode", () => {
  it("只读正文停留在阅读模式", () => {
    expect(normalizeBodyPaneMode("source", true)).toBe("preview");
    expect(toggleBodyPaneMode("preview", true)).toBe("preview");
  });

  it("可编辑正文在阅读和源码编辑模式之间切换", () => {
    expect(toggleBodyPaneMode("preview", false)).toBe("source");
    expect(toggleBodyPaneMode("source", false)).toBe("preview");
  });

  it("源码模式缺少编辑器实例时，需要重新渲染正文源码面板", () => {
    expect(shouldRenderBodyPaneMode("source", "source", false)).toBe(true);
    expect(shouldRenderBodyPaneMode("source", "source", true)).toBe(false);
    expect(shouldRenderBodyPaneMode("preview", "source", false)).toBe(true);
  });

  it("只有从已有源码编辑器切走时才需要先保存正文", () => {
    expect(shouldSaveBodyBeforeModeChange("source", "preview", true)).toBe(true);
    expect(shouldSaveBodyBeforeModeChange("source", "source", true)).toBe(false);
    expect(shouldSaveBodyBeforeModeChange("source", "source", false)).toBe(false);
    expect(shouldSaveBodyBeforeModeChange("preview", "source", false)).toBe(false);
  });

  it("过期的异步正文模式切换请求不能覆盖后来的用户意图", () => {
    expect(isLatestBodyPaneModeRequest(2, 2)).toBe(true);
    expect(isLatestBodyPaneModeRequest(1, 2)).toBe(false);
  });

  it("保持源码模式的用户意图也会生成新的模式请求", () => {
    expect(nextBodyPaneModeRequestId(2)).toBe(3);
  });
});
