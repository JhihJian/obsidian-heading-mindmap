export interface BodyPanePointerResizeInput {
  splitBottom: number;
  splitHeight: number;
  resizerHeight: number;
  clientY: number;
}

export interface BodyPaneResizeKeyInput {
  key: string;
  shiftKey: boolean;
  currentRatio: number;
}

export interface BodyPaneResizerAria {
  valueMin: string;
  valueMax: string;
  valueNow: string;
  valueText: string;
}

const BODY_PANE_MIN_PERCENT = 25;
const BODY_PANE_MAX_PERCENT = 80;

export function getBodyPaneHeightRatioFromPointer(input: BodyPanePointerResizeInput): number | null {
  if (input.splitHeight <= 0) return null;
  const bodyHeight = input.splitBottom - input.clientY - input.resizerHeight / 2;
  return bodyHeight / input.splitHeight;
}

export function getBodyPaneHeightRatioFromKey(input: BodyPaneResizeKeyInput): number | null {
  const step = input.shiftKey ? 0.1 : 0.05;

  if (input.key === "ArrowUp") return input.currentRatio + step;
  if (input.key === "ArrowDown") return input.currentRatio - step;
  if (input.key === "PageUp") return input.currentRatio + 0.1;
  if (input.key === "PageDown") return input.currentRatio - 0.1;
  if (input.key === "Home") return BODY_PANE_MIN_PERCENT / 100;
  if (input.key === "End") return BODY_PANE_MAX_PERCENT / 100;

  return null;
}

export function formatBodyPaneHeightRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

export function getBodyPaneResizerAria(heightRatio: number): BodyPaneResizerAria {
  const percent = Math.round(heightRatio * 100);
  return {
    valueMin: String(BODY_PANE_MIN_PERCENT),
    valueMax: String(BODY_PANE_MAX_PERCENT),
    valueNow: String(percent),
    valueText: `正文区域高度 ${percent}%`
  };
}
