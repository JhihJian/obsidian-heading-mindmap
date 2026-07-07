import { Notice } from "obsidian";
import { MarkdownFilePickerModal } from "./markdown-file-picker-modal";
import { getSelectionAfterSubtreeRemoval } from "./node-selection";
import { addFileChildNode, canEditNodeTitle, isReadonlyOutlineNode, READONLY_OUTLINE_MESSAGE, type OperationResult } from "./mindmap-operations";
import { dispatchMindmapShortcut } from "./mindmap-shortcut-dispatch";
import { shouldHandleDocumentShortcutTarget, shouldIgnoreMindmapShortcutTarget } from "./keyboard-shortcuts";
import { expandFileOutlineNode } from "./file-outline-runtime";
import type { MindNode } from "./mindmap-model";
import type { MindmapViewStore } from "./mindmap-view-store";
import type { MindmapViewRenderer } from "./mindmap-view-renderer";
import type { MindmapViewPersistence } from "./mindmap-view-persistence";
import type { MindmapViewLoader } from "./mindmap-view-loader";

export class MindmapViewActions {
  loader?: MindmapViewLoader;

  constructor(
    private readonly store: MindmapViewStore,
    private readonly renderer: MindmapViewRenderer,
    private readonly persistence: MindmapViewPersistence,
    private readonly containerEl: HTMLElement,
    private readonly getActiveView: () => unknown
  ) {}

  handleKeydown(event: KeyboardEvent): void {
    if (this.shouldIgnoreShortcut(event)) return;
    dispatchMindmapShortcut(event, {
      root: this.store.root,
      selectedNodeId: this.store.selectedNodeId,
      onOperation: (result, persist) => this.applyOperation(result, persist),
      onSelectNode: (nodeId) => {
        this.store.setSelectedNode(nodeId);
        this.renderer.updateSelectionView();
      },
      onFocusCanvas: () => this.renderer.focusCanvas(),
      onFocusBody: () => this.renderer.focusBodyEditor(),
      onStartTitleEdit: () => this.startTitleEdit()
    });
  }

  handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.shouldIgnoreShortcut(event)) return;
    if (!this.shouldHandleDocumentShortcut(event)) return;
    this.handleKeydown(event);
  }

  applyOperation(result: OperationResult, persist = true): void {
    if (!result.ok) {
      new Notice(result.message);
      if (result.selectedNodeId) this.store.setSelectedNode(result.selectedNodeId);
      return;
    }
    this.store.setSelectedNode(result.selectedNodeId);
    if (result.message) new Notice(result.message);
    const viewport = this.renderer.readViewportFromDom();
    if (persist) {
      void this.persistence.saveAndRender({ focusCanvas: true, viewport });
    } else {
      void this.persistence.saveUiState(viewport)
        .then(() => this.renderer.renderPreservingViewport({ focusCanvas: true, viewport }));
    }
  }

  async toggleFileOutline(node: MindNode): Promise<void> {
    if (node.outlineExpanded) {
      const viewport = this.renderer.readViewportFromDom();
      node.children = [];
      node.outlineExpanded = false;
      node.childrenCollapsed = false;
      this.store.setSelectedNode(getSelectionAfterSubtreeRemoval(this.store.root, this.store.selectedNodeId, node.id));
      await this.persistence.saveUiState(viewport);
      this.renderer.renderPreservingViewport({ focusCanvas: true, viewport });
      return;
    }

    const viewport = this.renderer.readViewportFromDom();
    const result = await expandFileOutlineNode(
      node,
      (fileNode) => this.store.plugin.resolveFileNodeTarget(fileNode, this.store.currentFile?.path ?? ""),
      (file) => this.store.plugin.app.vault.read(file)
    );
    if (!result.ok) {
      if (result.message) new Notice(result.message);
      return;
    }
    if (result.empty) new Notice("此文件没有可展开的 Markdown 标题。");
    await this.persistence.saveUiState(viewport);
    this.renderer.renderPreservingViewport({ focusCanvas: true, viewport });
  }

  toggleNodeChildrenFold(node: MindNode): void {
    const viewport = this.renderer.readViewportFromDom();
    node.childrenCollapsed = !node.childrenCollapsed;
    this.store.setSelectedNode(node.id);
    void this.persistence.saveUiState(viewport)
      .then(() => this.renderer.renderPreservingViewport({ focusCanvas: true, viewport }));
  }

  startTitleEdit(): void {
    const editable = canEditNodeTitle(this.store.root, this.store.selectedNodeId);
    if (!editable.ok) {
      new Notice(editable.message);
      return;
    }
    this.store.titleEditingNodeId = this.store.selectedNodeId;
    this.renderer.renderPreservingViewport();
  }

  async commitTitleEdit(node: MindNode, value: string): Promise<void> {
    if (this.store.titleEditingNodeId !== node.id) return;
    this.store.titleEditingNodeId = null;
    const nextTitle = value.trim() || "未命名节点";
    if (nextTitle !== node.title) {
      node.title = nextTitle;
      await this.persistence.saveAndRender({ focusCanvas: true });
      return;
    }
    this.renderer.renderPreservingViewport({ focusCanvas: true });
  }

  openFilePicker(): void {
    if (isReadonlyOutlineNode(this.store.root, this.store.selectedNodeId)) {
      new Notice(READONLY_OUTLINE_MESSAGE);
      return;
    }
    new MarkdownFilePickerModal(this.store.plugin, this.store.currentFile?.path, (file) => {
      this.applyOperation(addFileChildNode(this.store.root, this.store.selectedNodeId, file.path));
      this.renderer.focusCanvas();
    }).open();
  }

  async toggleListItemExpansion(): Promise<void> {
    await this.setListItemExpansion(!this.store.plugin.getExpandListItems());
  }

  async setListItemExpansion(value: boolean): Promise<void> {
    const viewport = this.renderer.readViewportFromDom();
    await this.persistence.saveUiState(viewport);
    await this.store.plugin.setExpandListItems(value);
    await this.loader?.loadFromState({ preserveSelection: true, viewport });
    this.renderer.focusCanvas();
  }

  private shouldIgnoreShortcut(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;
    return shouldIgnoreMindmapShortcutTarget({
      isContentEditable: target.isContentEditable,
      insideSourceEditor: Boolean(target.closest(".cm-editor, .markdown-source-view")),
      isEditableElement: target.matches("input, textarea, select"),
      isInteractiveElement: target.matches("button, a[href], [role='button'], [role='link']")
    });
  }

  private shouldHandleDocumentShortcut(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;
    const activeEl = activeDocument.activeElement;
    return shouldHandleDocumentShortcutTarget({
      targetInsideView: this.containerEl.contains(target),
      targetInsideModal: Boolean(target.closest(".modal")),
      activeViewIsMindmap: this.getActiveView() !== null,
      activeElementIsPageRoot:
        activeEl === activeDocument.body ||
        activeEl === activeDocument.documentElement ||
        activeEl === null
    });
  }
}
