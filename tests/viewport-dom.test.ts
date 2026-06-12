import { describe, expect, it } from "vitest";
import {
  getStableScrollAreaSize,
  preserveViewportForClose,
  preserveViewportForRender,
  restoreViewportScroll
} from "../src/viewport-dom";

describe("restoreViewportScroll", () => {
  it("同步恢复导图滚动位置，避免重渲染后先跳回顶部再恢复", () => {
    const scrollTarget = { scrollLeft: 0, scrollTop: 0 };

    restoreViewportScroll(scrollTarget, { scrollLeft: 120, scrollTop: 340 });

    expect(scrollTarget).toEqual({ scrollLeft: 120, scrollTop: 340 });
  });

  it("重渲染使用操作开始时捕获的视野，避免异步保存期间滚动值被重置", () => {
    expect(
      preserveViewportForRender(
        { scale: 1, scrollLeft: 0, scrollTop: 0 },
        { scale: 1, scrollLeft: 120, scrollTop: 40 }
      )
    ).toEqual({ scale: 1, scrollLeft: 120, scrollTop: 40 });
  });

  it("布局缩小后仍保留足够滚动区域，避免浏览器把当前 scrollLeft 夹回 0", () => {
    expect(getStableScrollAreaSize(700, 120, 900)).toBe(1020);
    expect(getStableScrollAreaSize(1200, 120, 900)).toBe(1200);
  });

  it("关闭视图时不让销毁阶段的零滚动覆盖已知视野", () => {
    expect(
      preserveViewportForClose(
        { scale: 1, scrollLeft: 120, scrollTop: 40 },
        { scale: 1, scrollLeft: 0, scrollTop: 0 }
      )
    ).toEqual({ scale: 1, scrollLeft: 120, scrollTop: 40 });

    expect(
      preserveViewportForClose(
        { scale: 1, scrollLeft: 120, scrollTop: 0 },
        { scale: 1, scrollLeft: 0, scrollTop: 0 }
      )
    ).toEqual({ scale: 1, scrollLeft: 120, scrollTop: 0 });

    expect(
      preserveViewportForClose(
        { scale: 1, scrollLeft: 120, scrollTop: 40 },
        { scale: 1, scrollLeft: 20, scrollTop: 0 }
      )
    ).toEqual({ scale: 1, scrollLeft: 20, scrollTop: 0 });
  });
});
