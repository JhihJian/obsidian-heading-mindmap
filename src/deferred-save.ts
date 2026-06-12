export type DeferredSaveState = {
  timer: number | null;
};

export function hasPendingDeferredSave(state: DeferredSaveState): boolean {
  return state.timer !== null;
}

export async function flushDeferredSave(
  state: DeferredSaveState,
  clearTimer: (timer: number) => void,
  save: () => Promise<void>
): Promise<void> {
  if (state.timer === null) return;
  clearTimer(state.timer);
  state.timer = null;
  await save();
}
