import type { MindmapViewportState } from "./mindmap-view-state";

export type ScrollViewportTarget = {
  scrollLeft: number;
  scrollTop: number;
};

export function preserveViewportForRender(
  currentViewport: MindmapViewportState,
  domViewport: MindmapViewportState | undefined
): MindmapViewportState {
  return domViewport ?? currentViewport;
}

export function getStableScrollAreaSize(
  contentSize: number,
  scrollOffset: number,
  viewportSize: number
): number {
  return Math.max(contentSize, scrollOffset + viewportSize);
}

export function restoreViewportScroll(
  target: ScrollViewportTarget,
  viewport: Pick<MindmapViewportState, "scrollLeft" | "scrollTop">
): void {
  target.scrollLeft = viewport.scrollLeft;
  target.scrollTop = viewport.scrollTop;
}

export function preserveViewportForClose(
  currentViewport: MindmapViewportState,
  domViewport: MindmapViewportState
): MindmapViewportState {
  if ((currentViewport.scrollLeft > 0 || currentViewport.scrollTop > 0) && domViewport.scrollLeft === 0 && domViewport.scrollTop === 0) {
    return currentViewport;
  }
  return domViewport;
}
