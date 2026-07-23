import type { MindmapViewStore } from "./mindmap-view-store";
import type { MindmapViewportState } from "./mindmap-view-state";
import {
  applyViewportToDom,
  getElementViewportSize,
  getFitViewportState,
  getZoomedViewportState,
  type ViewportPoint,
  type ViewportSize
} from "./viewport-dom";

export interface MindmapViewportRuntimeOptions {
  store: MindmapViewStore;
  containerEl: HTMLElement;
  getViewport: () => MindmapViewportState;
  onFocusCanvas: () => void;
  onScheduleSave: () => void;
}

export class MindmapViewportRuntime {
  constructor(private readonly options: MindmapViewportRuntimeOptions) {}

  setScale(scale: number, center?: ViewportPoint): void {
    const { store } = this.options;
    store.viewport = getZoomedViewportState(
      this.options.getViewport(),
      scale,
      getElementViewportSize(store.canvasEl),
      center
    );
    this.applyViewportState();
  }

  fitToView(): void {
    const { store } = this.options;
    if (!store.canvasEl) return;
    const layoutSize = getRenderedLayoutSize(store.surfaceEl);
    store.viewport = getFitViewportState(layoutSize, getElementViewportSize(store.canvasEl));
    this.applyViewportState(layoutSize);
    this.options.onFocusCanvas();
  }

  private applyViewportState(layoutSize = getRenderedLayoutSize(this.options.store.surfaceEl)): void {
    const { store } = this.options;
    applyViewportToDom({
      canvasEl: store.canvasEl,
      surfaceEl: store.surfaceEl,
      zoomLabelEl: this.options.containerEl.querySelector<HTMLElement>(".heading-mindmap-zoom-label"),
      layoutSize,
      viewport: store.viewport
    });
    this.options.onScheduleSave();
  }
}

function getRenderedLayoutSize(surfaceEl: HTMLElement | null | undefined): ViewportSize {
  return {
    width: Number.parseFloat(surfaceEl?.style.width ?? "0"),
    height: Number.parseFloat(surfaceEl?.style.height ?? "0")
  };
}
