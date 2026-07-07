import { describe, expect, it } from "vitest";
import {
  formatBodyPaneHeightRatio,
  getBodyPaneHeightRatioFromKey,
  getBodyPaneHeightRatioFromPointer,
  getBodyPaneResizerAria
} from "../src/body-pane-size";

describe("body pane size", () => {
  it("根据拖拽指针位置计算正文区域高度比例", () => {
    expect(
      getBodyPaneHeightRatioFromPointer({
        splitBottom: 1000,
        splitHeight: 800,
        resizerHeight: 8,
        clientY: 556
      })
    ).toBe(0.55);
  });

  it("split 高度无效时不产生拖拽比例", () => {
    expect(
      getBodyPaneHeightRatioFromPointer({
        splitBottom: 1000,
        splitHeight: 0,
        resizerHeight: 8,
        clientY: 556
      })
    ).toBeNull();
  });

  it("根据键盘操作计算下一步正文区域高度比例", () => {
    expect(getBodyPaneHeightRatioFromKey({ key: "ArrowUp", shiftKey: false, currentRatio: 0.55 })).toBeCloseTo(0.6);
    expect(getBodyPaneHeightRatioFromKey({ key: "ArrowDown", shiftKey: true, currentRatio: 0.55 })).toBeCloseTo(0.45);
    expect(getBodyPaneHeightRatioFromKey({ key: "PageUp", shiftKey: false, currentRatio: 0.55 })).toBeCloseTo(0.65);
    expect(getBodyPaneHeightRatioFromKey({ key: "PageDown", shiftKey: false, currentRatio: 0.55 })).toBeCloseTo(0.45);
    expect(getBodyPaneHeightRatioFromKey({ key: "Home", shiftKey: false, currentRatio: 0.55 })).toBe(0.25);
    expect(getBodyPaneHeightRatioFromKey({ key: "End", shiftKey: false, currentRatio: 0.55 })).toBe(0.8);
    expect(getBodyPaneHeightRatioFromKey({ key: "Enter", shiftKey: false, currentRatio: 0.55 })).toBeNull();
  });

  it("格式化正文区域高度 CSS 变量值", () => {
    expect(formatBodyPaneHeightRatio(0.55)).toBe("55.00%");
  });

  it("生成正文区域拖拽条 ARIA 状态", () => {
    expect(getBodyPaneResizerAria(0.553)).toEqual({
      valueMin: "25",
      valueMax: "80",
      valueNow: "55",
      valueText: "正文区域高度 55%"
    });
  });
});
