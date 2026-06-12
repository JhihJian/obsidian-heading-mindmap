import { describe, expect, it, vi } from "vitest";
import { flushDeferredSave, hasPendingDeferredSave } from "../src/deferred-save";

describe("deferred save", () => {
  it("关闭前清理待执行定时器并立即保存", async () => {
    const state = { timer: 12 };
    const clearTimer = vi.fn();
    const save = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await flushDeferredSave(state, clearTimer, save);

    expect(clearTimer).toHaveBeenCalledWith(12);
    expect(save).toHaveBeenCalledOnce();
    expect(hasPendingDeferredSave(state)).toBe(false);
  });

  it("没有待保存定时器时不触发保存", async () => {
    const state = { timer: null };
    const clearTimer = vi.fn();
    const save = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await flushDeferredSave(state, clearTimer, save);

    expect(clearTimer).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
