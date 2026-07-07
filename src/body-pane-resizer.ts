import { renderBodyPaneResizerElement } from "./body-pane-dom";
import {
  getBodyPaneHeightRatioFromKey,
  getBodyPaneHeightRatioFromPointer,
  getBodyPaneResizerAria
} from "./body-pane-size";

export interface BodyPaneResizerOptions {
  getHeightRatio: () => number;
  onHeightRatioChange: (ratio: number, split: HTMLElement, resizer: HTMLElement) => void;
  onSave: () => void;
  onScheduleSave: () => void;
}

export function renderBodyPaneResizer(container: HTMLElement, options: BodyPaneResizerOptions): void {
  renderBodyPaneResizerElement(container, {
    updateAria: (resizer) => updateBodyPaneResizerAria(resizer, options.getHeightRatio()),
    onPointerDown: (event, resizer) => startBodyPaneResize(event, container, resizer, options),
    onKeydown: (event, resizer) => handleBodyPaneResizeKeydown(event, container, resizer, options)
  });
}

function startBodyPaneResize(
  event: PointerEvent,
  split: HTMLElement,
  resizer: HTMLElement,
  options: BodyPaneResizerOptions
): void {
  if (event.button !== 0) return;
  event.preventDefault();
  const pointerId = event.pointerId;
  split.addClass("is-resizing");
  resizer.addClass("is-dragging");
  resizer.setPointerCapture(pointerId);
  setBodyPaneHeightFromPointer(event.clientY, split, resizer, options);

  const handlePointerMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    moveEvent.preventDefault();
    setBodyPaneHeightFromPointer(moveEvent.clientY, split, resizer, options);
  };
  const finishResize = (finishEvent: PointerEvent) => {
    if (finishEvent.pointerId !== pointerId) return;
    resizer.removeEventListener("pointermove", handlePointerMove);
    resizer.removeEventListener("pointerup", finishResize);
    resizer.removeEventListener("pointercancel", finishResize);
    split.removeClass("is-resizing");
    resizer.removeClass("is-dragging");
    if (resizer.hasPointerCapture(pointerId)) {
      resizer.releasePointerCapture(pointerId);
    }
    options.onSave();
  };

  resizer.addEventListener("pointermove", handlePointerMove);
  resizer.addEventListener("pointerup", finishResize);
  resizer.addEventListener("pointercancel", finishResize);
}

function setBodyPaneHeightFromPointer(
  clientY: number,
  split: HTMLElement,
  resizer: HTMLElement,
  options: BodyPaneResizerOptions
): void {
  const splitRect = split.getBoundingClientRect();
  const ratio = getBodyPaneHeightRatioFromPointer({
    splitBottom: splitRect.bottom,
    splitHeight: splitRect.height,
    resizerHeight: resizer.getBoundingClientRect().height,
    clientY
  });
  if (ratio === null) return;
  options.onHeightRatioChange(ratio, split, resizer);
}

function handleBodyPaneResizeKeydown(
  event: KeyboardEvent,
  split: HTMLElement,
  resizer: HTMLElement,
  options: BodyPaneResizerOptions
): void {
  const nextRatio = getBodyPaneHeightRatioFromKey({
    key: event.key,
    shiftKey: event.shiftKey,
    currentRatio: options.getHeightRatio()
  });
  if (nextRatio === null) return;
  event.preventDefault();
  event.stopPropagation();
  options.onHeightRatioChange(nextRatio, split, resizer);
  options.onScheduleSave();
}

export function updateBodyPaneResizerAria(resizer: HTMLElement, heightRatio: number): void {
  const aria = getBodyPaneResizerAria(heightRatio);
  resizer.setAttr("aria-valuemin", aria.valueMin);
  resizer.setAttr("aria-valuemax", aria.valueMax);
  resizer.setAttr("aria-valuenow", aria.valueNow);
  resizer.setAttr("aria-valuetext", aria.valueText);
}
