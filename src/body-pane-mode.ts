export type BodyPaneMode = "preview" | "source";

export function normalizeBodyPaneMode(mode: BodyPaneMode, readonly: boolean): BodyPaneMode {
  if (readonly) return "preview";
  return mode;
}

export function toggleBodyPaneMode(mode: BodyPaneMode, readonly: boolean): BodyPaneMode {
  if (readonly) return "preview";
  return mode === "preview" ? "source" : "preview";
}

export function shouldRenderBodyPaneMode(
  currentMode: BodyPaneMode,
  nextMode: BodyPaneMode,
  hasSourceEditor: boolean
): boolean {
  if (currentMode !== nextMode) return true;
  return nextMode === "source" && !hasSourceEditor;
}

export function shouldSaveBodyBeforeModeChange(
  currentMode: BodyPaneMode,
  nextMode: BodyPaneMode,
  hasSourceEditor: boolean
): boolean {
  return currentMode === "source" && nextMode !== "source" && hasSourceEditor;
}

export function isLatestBodyPaneModeRequest(requestId: number, latestRequestId: number): boolean {
  return requestId === latestRequestId;
}

export function nextBodyPaneModeRequestId(currentRequestId: number): number {
  return currentRequestId + 1;
}
