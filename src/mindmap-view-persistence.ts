import { Notice } from "obsidian";
import { applyListItemExpansion, type MindNode } from "./mindmap-model";
import { flushDeferredSave } from "./deferred-save";
import { getNodeKey, normalizeBodyPaneSize, type MindmapViewportState } from "./mindmap-view-state";
import { preserveViewportForClose } from "./viewport-dom";
import type { MindmapViewStore } from "./mindmap-view-store";

export interface MindmapPersistenceHost {
  readViewportFromDom(): MindmapViewportState;
  readBodyPaneSize(): ReturnType<typeof normalizeBodyPaneSize>;
  renderPreservingViewport(options?: { focusCanvas?: boolean; viewport?: MindmapViewportState }): void;
}

export class MindmapViewPersistence {
  constructor(private readonly store: MindmapViewStore, private readonly host: MindmapPersistenceHost) {
    this.store.onSaveBodyAfterEditing = () => {
      void this.saveBodyAfterEditing();
    };
    this.store.onBodyChanged = (node, body) => this.applyBodyEditorChange(node, body);
  }

  async close(): Promise<void> {
    if (this.store.saveStateTimer !== null) {
      window.clearTimeout(this.store.saveStateTimer);
      this.store.saveStateTimer = null;
    }
    const bodySaveState = { timer: this.store.bodySaveTimer };
    await flushDeferredSave(
      bodySaveState,
      (timer) => window.clearTimeout(timer),
      () => this.saveBodyWithoutRender()
    );
    this.store.bodySaveTimer = bodySaveState.timer;
    this.store.bodyPaneRuntime.destroyEditor();
    await this.saveUiState(preserveViewportForClose(this.store.viewport, this.host.readViewportFromDom()));
  }

  async saveAndRender(options: { focusCanvas?: boolean; viewport?: MindmapViewportState } = {}): Promise<void> {
    const viewport = options.viewport ?? this.host.readViewportFromDom();
    await this.saveUiState(viewport);
    try {
      await this.persistCurrentMindmap();
      this.host.renderPreservingViewport(options);
    } catch {
      new Notice("保存思维导图失败，请检查文件是否可写。");
    }
  }

  async saveUiState(viewport = this.host.readViewportFromDom()): Promise<void> {
    if (!this.store.filePath) return;
    this.store.viewport = viewport;
    this.store.bodyPane = this.host.readBodyPaneSize();
    this.store.selectedNodeKey = getNodeKey(this.store.root, this.store.selectedNodeId) ?? undefined;
    this.store.plugin.app.workspace.requestSaveLayout();
    await this.store.plugin.saveMindmapState(this.store.filePath, this.store.root, this.store.viewport, this.store.bodyPane);
  }

  scheduleUiStateSave(): void {
    if (this.store.saveStateTimer !== null) {
      window.clearTimeout(this.store.saveStateTimer);
    }
    this.store.saveStateTimer = window.setTimeout(() => {
      this.store.saveStateTimer = null;
      void this.saveUiState();
    }, 200);
  }

  scheduleBodyPersist(): void {
    if (this.store.bodySaveTimer !== null) {
      window.clearTimeout(this.store.bodySaveTimer);
    }
    this.store.bodySaveTimer = window.setTimeout(() => {
      this.store.bodySaveTimer = null;
      void this.saveBodyWithoutRender();
    }, 500);
  }

  async saveBodyWithoutRender(): Promise<void> {
    await this.saveUiState();
    try {
      await this.persistCurrentMindmap();
      this.store.pendingBodyEdits.clear();
    } catch {
      new Notice("保存正文失败，请检查文件是否可写。");
    }
  }

  async saveBodyAfterEditing(): Promise<void> {
    if (this.store.bodySaveTimer !== null) {
      window.clearTimeout(this.store.bodySaveTimer);
      this.store.bodySaveTimer = null;
    }
    await this.saveBodyWithoutRender();
    if (this.store.plugin.getExpandListItems()) {
      this.host.renderPreservingViewport();
    }
  }

  private async persistCurrentMindmap(): Promise<void> {
    if (!this.store.currentFile) return;
    const save = this.store.saveQueue.then(() => this.store.plugin.persistMindmap(this.store.currentFile!, this.store.root));
    this.store.saveQueue = save.catch(() => undefined);
    await save;
  }

  private applyBodyEditorChange(node: MindNode, body: string): void {
    node.body = body;
    node.bodyCollapsed = false;
    const nodeKey = getNodeKey(this.store.root, node.id);
    if (nodeKey) {
      this.store.pendingBodyEdits.set(nodeKey, { nodeKey, body: node.body });
    }
    if (this.store.plugin.getExpandListItems()) {
      applyListItemExpansion(this.store.root, { expandListItems: true });
    }
    this.scheduleBodyPersist();
  }
}
