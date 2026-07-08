import { Notice } from "obsidian";
import { renderBodyPaneShell } from "./body-pane-dom";
import { renderBodyPaneResizer, updateBodyPaneResizerAria } from "./body-pane-resizer";
import { formatBodyPaneHeightRatio } from "./body-pane-size";
import { getBodyPaneMeta } from "./body-pane-meta";
import {
  isLatestBodyPaneModeRequest,
  nextBodyPaneModeRequestId,
  normalizeBodyPaneMode,
  shouldRenderBodyPaneMode,
  shouldSaveBodyBeforeModeChange,
  type BodyPaneMode
} from "./body-pane-mode";
import { isReadonlyOutlineNode, READONLY_OUTLINE_MESSAGE } from "./mindmap-operations";
import { findNode } from "./mindmap-navigation";
import { renderMindmapCanvas } from "./mindmap-canvas-dom";
import { renderMindmapToolbar } from "./mindmap-toolbar-dom";
import { layoutMindmap } from "./tree-layout";
import {
  applyViewportToDom, getElementViewportSize, getFitViewportState, getZoomedViewportState,
  preserveViewportForRender, type ViewportPoint
} from "./viewport-dom";
import {
  DEFAULT_VIEWPORT_SCALE,
  VIEWPORT_SCALE_STEP,
  normalizeBodyPaneSize,
  normalizeViewportState,
  type BodyPaneSizeState,
  type MindmapViewportState
} from "./mindmap-view-state";
import type { MindNode } from "./mindmap-model";
import type { MindmapViewStore } from "./mindmap-view-store";
import type { MindmapViewActions } from "./mindmap-view-actions";
import type { MindmapViewPersistence } from "./mindmap-view-persistence";

export class MindmapViewRenderer {
  actions?: MindmapViewActions;
  persistence?: MindmapViewPersistence;

  constructor(private readonly store: MindmapViewStore, private readonly containerEl: HTMLElement) {}

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    this.store.bodyPaneRuntime.destroyEditor();
    container.empty();
    container.addClass("heading-mindmap-view");
    container.setAttr("tabindex", "0");
    container.onkeydown = (event: KeyboardEvent) => {
      event.stopPropagation();
      this.actions?.handleKeydown(event);
    };

    const toolbar = container.createDiv({ cls: "heading-mindmap-toolbar" });
    renderMindmapToolbar(toolbar, {
      title: this.store.currentFile?.basename ?? "思维导图",
      path: this.store.currentFile?.path ?? "选择或创建一个 Markdown 导图文件",
      scale: this.store.viewport.scale,
      expandListItems: this.store.plugin.getExpandListItems(),
      onZoomOut: () => this.setScale(this.readViewportFromDom().scale - VIEWPORT_SCALE_STEP),
      onZoomIn: () => this.setScale(this.readViewportFromDom().scale + VIEWPORT_SCALE_STEP),
      onFitToView: () => this.fitToView(),
      onResetZoom: () => this.setScale(DEFAULT_VIEWPORT_SCALE),
      onToggleListItems: (value) => {
        void this.actions?.setListItemExpansion(value);
      },
      onAddFileNode: () => this.actions?.openFilePicker()
    });

    const split = container.createDiv({ cls: "heading-mindmap-split" });
    this.store.splitEl = split;
    this.applyBodyPaneSizeToSplit(split);

    this.store.canvasEl = split.createDiv({ cls: "heading-mindmap-canvas" });
    this.store.surfaceEl = renderMindmapCanvas(this.store.canvasEl, {
      root: this.store.root,
      viewport: this.store.viewport,
      selectedNodeId: this.store.selectedNodeId,
      titleEditingNodeId: this.store.titleEditingNodeId,
      onKeydown: (event) => this.actions?.handleKeydown(event),
      onScroll: () => this.persistence?.scheduleUiStateSave(),
      onFocusCanvas: () => this.focusCanvas(),
      onScaleChange: (scaleDelta, center) => this.setScale(this.readViewportFromDom().scale + scaleDelta, center),
      onSelectNode: (nodeId) => {
        this.store.setSelectedNode(nodeId);
        this.updateSelectionView();
      },
      onToggleFileOutline: (node) => {
        void this.actions?.toggleFileOutline(node);
      },
      onToggleNodeChildrenFold: (node) => this.actions?.toggleNodeChildrenFold(node),
      onCommitTitleEdit: (node, value) => {
        void this.actions?.commitTitleEdit(node, value);
      },
      onCancelTitleEdit: () => {
        this.store.titleEditingNodeId = null;
        this.renderPreservingViewport({ focusCanvas: true });
      }
    }).surfaceEl;

    this.renderBodyPaneResizer(split);
    this.renderBodyPane(split);
  }

  renderPreservingViewport(options: { focusCanvas?: boolean; viewport?: MindmapViewportState } = {}): void {
    this.store.viewport = preserveViewportForRender(this.store.viewport, options.viewport ?? this.readViewportFromDom());
    this.render();
    if (options.focusCanvas) {
      window.setTimeout(() => this.focusCanvas(), 0);
    }
  }

  readViewportFromDom(): MindmapViewportState {
    return normalizeViewportState({
      scale: this.store.viewport.scale,
      scrollLeft: this.store.canvasEl?.scrollLeft ?? this.store.viewport.scrollLeft,
      scrollTop: this.store.canvasEl?.scrollTop ?? this.store.viewport.scrollTop
    });
  }

  readBodyPaneSize(): BodyPaneSizeState {
    return normalizeBodyPaneSize(this.store.bodyPane);
  }

  focusCanvas(): void {
    this.store.canvasEl?.focus({ preventScroll: true });
  }

  updateSelectionView(): void {
    const surface = this.store.surfaceEl;
    if (!surface) return;

    surface.querySelectorAll<HTMLElement>(".heading-mindmap-node.is-selected").forEach((nodeEl) => {
      nodeEl.removeClass("is-selected");
    });

    const selectedEl = surface.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(this.store.selectedNodeId)}"]`);
    selectedEl?.addClass("is-selected");

    const split = this.store.canvasEl?.parentElement;
    const oldPane = split?.querySelector<HTMLElement>(".heading-mindmap-body-pane");
    if (split && oldPane) {
      this.store.bodyPaneRuntime.destroyEditor();
      oldPane.remove();
      this.renderBodyPane(split);
    }
  }

  focusBodyEditor(): void {
    if (isReadonlyOutlineNode(this.store.root, this.store.selectedNodeId)) {
      new Notice(READONLY_OUTLINE_MESSAGE);
      return;
    }
    if (this.store.bodyPane.minimized) {
      void this.setBodyPaneMinimized(false, { focusEditor: true });
      return;
    }
    if (this.store.bodyPaneMode !== "source") {
      void this.setBodyPaneMode("source", { focusEditor: true });
      return;
    }
    this.store.bodyPaneModeRequestId = nextBodyPaneModeRequestId(this.store.bodyPaneModeRequestId);
    this.store.bodyPaneRuntime.focusEditorView();
    this.store.bodyPaneRuntime.scheduleEditorFocus();
  }

  async setBodyPaneMode(mode: BodyPaneMode, options: { focusEditor?: boolean } = {}): Promise<void> {
    const requestId = nextBodyPaneModeRequestId(this.store.bodyPaneModeRequestId);
    this.store.bodyPaneModeRequestId = requestId;
    const hasSourceEditor = this.store.bodyPaneRuntime.hasEditor();
    if (shouldSaveBodyBeforeModeChange(this.store.bodyPaneMode, mode, hasSourceEditor)) {
      await this.persistence?.saveBodyAfterEditing();
    }
    if (!isLatestBodyPaneModeRequest(requestId, this.store.bodyPaneModeRequestId)) return;
    const shouldRender = shouldRenderBodyPaneMode(this.store.bodyPaneMode, mode, hasSourceEditor);
    this.store.bodyPaneMode = mode;
    if (shouldRender) this.renderBodyPaneOnly();
    if (options.focusEditor || mode === "source") {
      this.store.bodyPaneRuntime.focusEditorView();
      this.store.bodyPaneRuntime.scheduleEditorFocus();
      return;
    }
    window.setTimeout(() => this.focusCanvas(), 0);
  }

  async setBodyPaneMinimized(minimized: boolean, options: { focusEditor?: boolean } = {}): Promise<void> {
    if (this.store.bodyPane.minimized === minimized) return;
    const viewport = this.readViewportFromDom();
    if (minimized && this.store.bodyPaneRuntime.hasEditor()) {
      await this.persistence?.saveBodyAfterEditing();
    }
    this.store.bodyPane = normalizeBodyPaneSize({ ...this.store.bodyPane, minimized });
    await this.persistence?.saveUiState(viewport);
    this.renderPreservingViewport({ viewport, focusCanvas: !options.focusEditor });
    if (options.focusEditor) {
      void this.setBodyPaneMode("source", { focusEditor: true });
    }
  }

  private renderBodyPane(container: HTMLElement): void {
    const node = this.getSelectedNode();
    const readonly = isReadonlyOutlineNode(this.store.root, node.id);
    this.store.bodyPaneMode = normalizeBodyPaneMode(this.store.bodyPaneMode, readonly);
    const minimized = this.store.bodyPane.minimized;
    if (minimized) {
      this.store.bodyPaneRuntime.destroyEditor();
      this.store.bodyPaneRuntime.clearPreview();
    }

    const pane = renderBodyPaneShell(container, {
      title: node.title,
      meta: getBodyPaneMeta(node, { currentFilePath: this.store.currentFile?.path ?? "", readonly }),
      mode: this.store.bodyPaneMode,
      minimized,
      readonly,
      onToggleMinimized: () => void this.setBodyPaneMinimized(!this.store.bodyPane.minimized),
      onSetMode: (mode) => void this.setBodyPaneMode(mode)
    });

    if (minimized) return;
    if (this.store.bodyPaneMode === "source" && !readonly) {
      this.store.bodyPaneRuntime.renderSource(pane, node);
    } else {
      this.store.bodyPaneRuntime.renderPreview(pane, node);
    }
  }

  private renderBodyPaneResizer(container: HTMLElement): void {
    if (this.store.bodyPane.minimized) return;
    renderBodyPaneResizer(container, {
      getHeightRatio: () => this.store.bodyPane.heightRatio,
      onHeightRatioChange: (ratio, split, resizer) => this.setBodyPaneHeightRatio(ratio, split, resizer),
      onSave: () => void this.persistence?.saveUiState(),
      onScheduleSave: () => this.persistence?.scheduleUiStateSave()
    });
  }

  private setBodyPaneHeightRatio(ratio: number, split = this.store.splitEl, resizer?: HTMLElement): void {
    this.store.bodyPane = normalizeBodyPaneSize({ ...this.store.bodyPane, heightRatio: ratio, minimized: false });
    this.applyBodyPaneSizeToSplit(split);
    const target = resizer ?? split?.querySelector<HTMLElement>(".heading-mindmap-body-resizer");
    if (target) updateBodyPaneResizerAria(target, this.store.bodyPane.heightRatio);
  }

  private applyBodyPaneSizeToSplit(split = this.store.splitEl): void {
    if (!split) return;
    split.style.setProperty("--mindmap-body-pane-height", formatBodyPaneHeightRatio(this.store.bodyPane.heightRatio));
    if (this.store.bodyPane.minimized) split.addClass("is-body-pane-minimized");
    else split.removeClass("is-body-pane-minimized");
  }

  private renderBodyPaneOnly(): void {
    const split = this.store.canvasEl?.parentElement;
    const oldPane = split?.querySelector<HTMLElement>(".heading-mindmap-body-pane");
    if (!split || !oldPane) return;
    this.store.bodyPaneRuntime.destroyEditor();
    oldPane.remove();
    this.applyBodyPaneSizeToSplit(split);
    this.renderBodyPane(split);
  }

  private setScale(scale: number, center?: ViewportPoint): void {
    this.store.viewport = getZoomedViewportState(
      this.readViewportFromDom(),
      scale,
      getElementViewportSize(this.store.canvasEl),
      center
    );
    this.applyViewportState();
  }

  private fitToView(): void {
    const canvas = this.store.canvasEl;
    if (!canvas) return;
    const layout = layoutMindmap(this.store.root);
    this.store.viewport = getFitViewportState(
      { width: layout.width, height: layout.height },
      getElementViewportSize(this.store.canvasEl)
    );
    this.applyViewportState(layout);
    this.focusCanvas();
  }

  private applyViewportState(layout = layoutMindmap(this.store.root)): void {
    this.store.viewport = normalizeViewportState(this.store.viewport);
    applyViewportToDom({
      canvasEl: this.store.canvasEl,
      surfaceEl: this.store.surfaceEl,
      zoomLabelEl: this.containerEl.querySelector<HTMLElement>(".heading-mindmap-zoom-label"),
      layoutSize: { width: layout.width, height: layout.height },
      viewport: this.store.viewport
    });
    this.persistence?.scheduleUiStateSave();
  }

  private getSelectedNode(): MindNode {
    return findNode(this.store.root, this.store.selectedNodeId) ?? this.store.root;
  }
}
