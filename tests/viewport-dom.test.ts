import { describe, expect, it } from "vitest";
import {
  getFitViewportState,
  getStableScrollAreaSize,
  getSurfacePlacement,
  getZoomedViewportState,
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

  it("适配全图按当前画布尺寸缩放，并在移动端窄画布中居中小导图", () => {
    const viewport = getFitViewportState({ width: 1200, height: 800 }, { width: 360, height: 640 });
    const placement = getSurfacePlacement({ width: 1200, height: 800 }, { width: 360, height: 640 }, viewport);

    expect(viewport.scale).toBeCloseTo(0.26);
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
    expect(placement.offsetLeft).toBeCloseTo(24);
    expect(placement.offsetTop).toBeCloseTo(216);
  });

  it("缩放时保持当前视野中心，避免放大后跳回左上角", () => {
    expect(
      getZoomedViewportState(
        { scale: 1, scrollLeft: 100, scrollTop: 80 },
        2,
        { width: 300, height: 200 }
      )
    ).toEqual({
      scale: 2,
      scrollLeft: 350,
      scrollTop: 260
    });
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
