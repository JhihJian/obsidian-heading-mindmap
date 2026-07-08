import {
  clampViewportScale,
  normalizeViewportState,
  type MindmapViewportState
} from "./mindmap-view-state";

export type ScrollViewportTarget = {
  scrollLeft: number;
  scrollTop: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type ViewportPoint = {
  x: number;
  y: number;
};

export type SurfacePlacement = {
  offsetLeft: number;
  offsetTop: number;
  scrollAreaWidth: number;
  scrollAreaHeight: number;
};

export type MindmapViewportDomTarget = {
  canvasEl: HTMLElement | null | undefined;
  surfaceEl: HTMLElement | null | undefined;
  zoomLabelEl?: HTMLElement | null;
  layoutSize: ViewportSize;
  viewport: MindmapViewportState;
};

const FIT_VIEWPORT_PADDING = 24;

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

export function getFitViewportState(
  contentSize: ViewportSize,
  viewportSize: ViewportSize,
  padding = FIT_VIEWPORT_PADDING
): MindmapViewportState {
  const scale = getFitViewportScale(contentSize, viewportSize, padding);
  const scaledWidth = contentSize.width * scale;
  const scaledHeight = contentSize.height * scale;

  return normalizeViewportState({
    scale,
    scrollLeft: getCenteredScrollOffset(scaledWidth, viewportSize.width),
    scrollTop: getCenteredScrollOffset(scaledHeight, viewportSize.height)
  });
}

export function getZoomedViewportState(
  currentViewport: MindmapViewportState,
  scale: number,
  viewportSize: ViewportSize,
  center: ViewportPoint = { x: viewportSize.width / 2, y: viewportSize.height / 2 }
): MindmapViewportState {
  const nextScale = clampViewportScale(scale);
  const centerX = center.x;
  const centerY = center.y;
  const mapCenterX = (currentViewport.scrollLeft + centerX) / currentViewport.scale;
  const mapCenterY = (currentViewport.scrollTop + centerY) / currentViewport.scale;

  return normalizeViewportState({
    scale: nextScale,
    scrollLeft: mapCenterX * nextScale - centerX,
    scrollTop: mapCenterY * nextScale - centerY
  });
}

export function getSurfacePlacement(
  contentSize: ViewportSize,
  viewportSize: ViewportSize,
  viewport: MindmapViewportState
): SurfacePlacement {
  const scaledWidth = contentSize.width * viewport.scale;
  const scaledHeight = contentSize.height * viewport.scale;
  const offsetLeft = getCenteredSurfaceOffset(scaledWidth, viewportSize.width);
  const offsetTop = getCenteredSurfaceOffset(scaledHeight, viewportSize.height);

  return {
    offsetLeft,
    offsetTop,
    scrollAreaWidth: getStableScrollAreaSize(scaledWidth + offsetLeft, viewport.scrollLeft, viewportSize.width),
    scrollAreaHeight: getStableScrollAreaSize(scaledHeight + offsetTop, viewport.scrollTop, viewportSize.height)
  };
}

export function getElementViewportSize(element: HTMLElement | null | undefined): ViewportSize {
  return {
    width: element?.clientWidth ?? 0,
    height: element?.clientHeight ?? 0
  };
}

export function applyViewportToDom(target: MindmapViewportDomTarget): void {
  const viewportSize = getElementViewportSize(target.canvasEl);
  const placement = getSurfacePlacement(target.layoutSize, viewportSize, target.viewport);
  const scrollArea = target.surfaceEl?.parentElement;

  if (scrollArea) {
    scrollArea.style.width = `${placement.scrollAreaWidth}px`;
    scrollArea.style.height = `${placement.scrollAreaHeight}px`;
  }
  if (target.surfaceEl) {
    target.surfaceEl.style.left = `${placement.offsetLeft}px`;
    target.surfaceEl.style.top = `${placement.offsetTop}px`;
    target.surfaceEl.style.transform = `scale(${target.viewport.scale})`;
  }
  if (target.canvasEl) restoreViewportScroll(target.canvasEl, target.viewport);
  updateZoomLabel(target.zoomLabelEl, target.viewport.scale);
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

function getFitViewportScale(contentSize: ViewportSize, viewportSize: ViewportSize, padding: number): number {
  const availableWidth = Math.max(1, viewportSize.width - padding * 2);
  const availableHeight = Math.max(1, viewportSize.height - padding * 2);
  const rawScale = Math.min(
    availableWidth / Math.max(1, contentSize.width),
    availableHeight / Math.max(1, contentSize.height)
  );
  return clampViewportScale(rawScale);
}

function getCenteredScrollOffset(scaledContentSize: number, viewportSize: number): number {
  return Math.max(0, (scaledContentSize - viewportSize) / 2);
}

function getCenteredSurfaceOffset(scaledContentSize: number, viewportSize: number): number {
  return Math.max(0, (viewportSize - scaledContentSize) / 2);
}

function updateZoomLabel(label: HTMLElement | null | undefined, scale: number): void {
  if (!label) return;
  const text = `${Math.round(scale * 100)}%`;
  label.textContent = text;
  label.setAttr("aria-label", `当前缩放 ${text}`);
}
