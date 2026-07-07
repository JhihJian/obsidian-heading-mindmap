import { Notice, TFile } from "obsidian";
import { applyListItemExpansion } from "./mindmap-model";
import { applyPendingBodyEdits } from "./pending-body-edit";
import { getSelectionAfterReload } from "./node-selection";
import {
  getNodeIdByKey,
  getNodeKey,
  normalizeBodyPaneSize,
  normalizeViewportState,
  resolveInitialBodyPaneSize,
  resolveInitialViewportState,
  type MindmapViewportState
} from "./mindmap-view-state";
import { decideMindmapStateLoadPolicy } from "./view-state-load-policy";
import { findExpandedFileNode, refreshExpandedFileOutline } from "./file-outline-runtime";
import type { MindmapViewState } from "./mindmap-view-config";
import type { MindmapViewStore } from "./mindmap-view-store";
import type { MindmapViewRenderer } from "./mindmap-view-renderer";
import type { MindmapViewPersistence } from "./mindmap-view-persistence";

export class MindmapViewLoader {
  constructor(
    private readonly store: MindmapViewStore,
    private readonly renderer: MindmapViewRenderer,
    private readonly persistence: MindmapViewPersistence
  ) {}

  getState(): Record<string, unknown> {
    return {
      filePath: this.store.filePath,
      selectedNodeKey: getNodeKey(this.store.root, this.store.selectedNodeId) ?? this.store.selectedNodeKey,
      viewport: this.renderer.readViewportFromDom(),
      bodyPane: this.renderer.readBodyPaneSize()
    } satisfies MindmapViewState;
  }

  async setState(state: MindmapViewState): Promise<void> {
    this.store.leafState = state;
    this.store.hasLeafState = true;
    this.store.filePath = state.filePath;
    this.store.viewport = normalizeViewportState(state.viewport);
    this.store.bodyPane = normalizeBodyPaneSize(state.bodyPane);
    this.store.selectedNodeKey = state.selectedNodeKey;
    await this.loadFromState();
  }

  matchesFile(filePath: string): boolean {
    return this.store.filePath === filePath;
  }

  getFilePath(): string | undefined {
    return this.store.filePath;
  }

  usesExpandedFile(filePath: string): boolean {
    return findExpandedFileNode(
      this.store.root,
      filePath,
      (node) => this.store.plugin.resolveFileNodeTarget(node, this.store.currentFile?.path ?? "")
    ) !== null;
  }

  async refreshExpandedFile(file: TFile): Promise<void> {
    const refreshed = await refreshExpandedFileOutline(
      this.store.root,
      file,
      (node) => this.store.plugin.resolveFileNodeTarget(node, this.store.currentFile?.path ?? ""),
      () => this.store.plugin.app.vault.read(file)
    );
    if (refreshed) this.renderer.renderPreservingViewport();
  }

  async reloadFromDisk(): Promise<void> {
    const viewport = this.renderer.readViewportFromDom();
    if (this.store.filePath) {
      await this.store.plugin.saveMindmapState(this.store.filePath, this.store.root, viewport, this.renderer.readBodyPaneSize());
    }
    this.store.viewport = viewport;
    await this.loadFromState({ preserveSelection: true, viewport });
  }

  async loadFromState(
    options: { preserveSelection?: boolean; viewport?: Partial<MindmapViewportState> } = {}
  ): Promise<void> {
    const state = this.store.leafState;
    this.store.filePath = state.filePath;

    const policy = decideMindmapStateLoadPolicy(this.store.filePath, this.store.hasLeafState);
    if (policy === "await-state") return;
    if (policy === "activate-default") {
      await this.store.plugin.activateView();
      return;
    }

    const filePath = this.store.filePath;
    if (!filePath) return;

    const file = this.store.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      new Notice(`找不到思维导图文件：${filePath}`);
      this.renderer.render();
      return;
    }

    const previousSelectedId = this.store.selectedNodeId;
    this.store.root = await this.store.plugin.readMindmapFile(file);
    if (applyPendingBodyEdits(this.store.root, this.store.pendingBodyEdits.values()) > 0 && this.store.plugin.getExpandListItems()) {
      applyListItemExpansion(this.store.root, { expandListItems: true });
    }
    this.store.currentFile = file;
    const storedState = this.store.plugin.getStoredMindmapState(filePath);
    this.store.viewport = resolveInitialViewportState(options.viewport ?? state.viewport, storedState);
    this.store.bodyPane = resolveInitialBodyPaneSize(state.bodyPane, storedState);
    const selectedFromState = getNodeIdByKey(this.store.root, this.store.selectedNodeKey);
    this.store.setSelectedNode(
      getSelectionAfterReload(
        this.store.root,
        previousSelectedId,
        selectedFromState,
        options.preserveSelection
      )
    );
    this.renderer.render();
  }
}
