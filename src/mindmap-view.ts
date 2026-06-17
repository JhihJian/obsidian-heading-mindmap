import {
  ButtonComponent,
  ItemView,
  MarkdownRenderer,
  Notice,
  TFile,
  WorkspaceLeaf,
  setTooltip
} from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  BODY_EDITOR_HOST_CLASSES,
  BODY_PREVIEW_CONTENT_CLASSES,
  BODY_READING_VIEW_CLASSES,
  BODY_SOURCE_VIEW_CLASSES
} from "./body-pane-classes";
import { getBodyPaneMeta } from "./body-pane-meta";
import { getBodyPreviewSourcePath } from "./body-preview-source";
import {
  isLatestBodyPaneModeRequest,
  nextBodyPaneModeRequestId,
  normalizeBodyPaneMode,
  shouldRenderBodyPaneMode,
  shouldSaveBodyBeforeModeChange,
  toggleBodyPaneMode,
  type BodyPaneMode
} from "./body-pane-mode";
import { flushDeferredSave } from "./deferred-save";
import {
  getMindmapShortcutAction,
  shouldHandleDocumentShortcutTarget,
  shouldIgnoreMindmapShortcutTarget
} from "./keyboard-shortcuts";
import {
  applyListItemExpansion,
  buildOutlineTreeFromMarkdown,
  createStarterMindmap,
  type MindNode
} from "./mindmap-model";
import { findNode, getDirectionalNodeId } from "./mindmap-navigation";
import { MarkdownFilePickerModal } from "./markdown-file-picker-modal";
import { applyPendingBodyEdits, type PendingBodyEdit } from "./pending-body-edit";
import {
  getSelectionAfterReload,
  getSelectionAfterSubtreeRemoval,
  getSelectionUpdate,
  shouldChangeSelectedNode
} from "./node-selection";
import {
  addChildNode,
  addFileChildNode,
  addSiblingNode,
  canEditNodeTitle,
  deleteNode,
  moveNodeWithinSiblings,
  promoteNode,
  isReadonlyOutlineNode,
  READONLY_OUTLINE_MESSAGE,
  toggleNodeFold,
  type OperationResult
} from "./mindmap-operations";
import {
  getNodeIdByKey,
  getNodeKey,
  normalizeViewportState,
  resolveInitialViewportState,
  type MindmapViewportState
} from "./mindmap-view-state";
import { VIEW_TYPE_MINDMAP, type MindmapViewState } from "./mindmap-view-config";
import { layoutConstants, layoutMindmap } from "./tree-layout";
import {
  getStableScrollAreaSize,
  preserveViewportForClose,
  preserveViewportForRender,
  restoreViewportScroll
} from "./viewport-dom";
import { decideMindmapStateLoadPolicy } from "./view-state-load-policy";
import type HeadingMindmapPlugin from "./main";
export class HeadingMindmapView extends ItemView {
  private plugin: HeadingMindmapPlugin;
  private root: MindNode = createStarterMindmap();
  private currentFile: TFile | null = null;
  private selectedNodeId: string;
  private canvasEl?: HTMLElement;
  private surfaceEl?: HTMLElement;
  private previewEl?: HTMLElement;
  private bodyEditorView?: EditorView;
  private previewRenderVersion = 0;
  private bodyPaneMode: BodyPaneMode = "preview";
  private titleEditingNodeId: string | null = null;
  private filePath?: string;
  private viewport: MindmapViewportState = normalizeViewportState(undefined);
  private selectedNodeKey?: string;
  private pendingBodyEdits = new Map<string, PendingBodyEdit>();
  private saveStateTimer: number | null = null;
  private bodySaveTimer: number | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private bodyPaneModeRequestId = 0;
  private leafState: MindmapViewState = {};
  private hasLeafState = false;

  constructor(leaf: WorkspaceLeaf, plugin: HeadingMindmapPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.selectedNodeId = this.root.id;
  }

  getViewType(): string {
    return VIEW_TYPE_MINDMAP;
  }

  getDisplayText(): string {
    return this.currentFile?.basename ?? "Heading Mindmap";
  }

  getIcon(): string {
    return "git-fork";
  }

  async onOpen(): Promise<void> {
    this.registerDomEvent(document, "keydown", (event) => {
      this.handleDocumentKeydown(event);
    });
  }

  async onClose(): Promise<void> {
    if (this.saveStateTimer !== null) {
      window.clearTimeout(this.saveStateTimer);
      this.saveStateTimer = null;
    }
    const bodySaveState = { timer: this.bodySaveTimer };
    await flushDeferredSave(bodySaveState, (timer) => window.clearTimeout(timer), () => this.saveBodyWithoutRender());
    this.bodySaveTimer = bodySaveState.timer;
    this.destroyBodyEditor();
    await this.saveUiState(preserveViewportForClose(this.viewport, this.readViewportFromDom()));
  }

  getState(): Record<string, unknown> {
    return {
      filePath: this.filePath,
      selectedNodeKey: getNodeKey(this.root, this.selectedNodeId) ?? this.selectedNodeKey,
      viewport: this.readViewportFromDom()
    } satisfies MindmapViewState;
  }

  async setState(state: MindmapViewState, result: { history: boolean }): Promise<void> {
    await super.setState(state, result);
    this.leafState = state;
    this.hasLeafState = true;
    this.filePath = state.filePath;
    this.viewport = normalizeViewportState(state.viewport);
    this.selectedNodeKey = state.selectedNodeKey;
    await this.loadFromState();
  }

  matchesFile(filePath: string): boolean {
    return this.filePath === filePath;
  }

  getFilePath(): string | undefined {
    return this.filePath;
  }

  private setSelectedNode(nodeId: string): void {
    this.selectedNodeId = nodeId;
    this.selectedNodeKey = getNodeKey(this.root, this.selectedNodeId) ?? undefined;
  }

  usesExpandedFile(filePath: string): boolean {
    return this.findExpandedFileNode(filePath) !== null;
  }

  async refreshExpandedFile(file: TFile): Promise<void> {
    const node = this.findExpandedFileNode(file.path);
    if (!node) return;

    node.children = buildOutlineTreeFromMarkdown(file.path, await this.plugin.app.vault.read(file));
    node.childrenCollapsed = false;
    this.renderPreservingViewport();
  }

  async reloadFromDisk(): Promise<void> {
    const viewport = this.readViewportFromDom();
    if (this.filePath) {
      await this.plugin.saveMindmapState(this.filePath, this.root, viewport);
    }
    this.viewport = viewport;
    await this.loadFromState({ preserveSelection: true, viewport });
  }

  private async loadFromState(
    options: { preserveSelection?: boolean; viewport?: Partial<MindmapViewportState> } = {}
  ): Promise<void> {
    const state = this.leafState;
    this.filePath = state.filePath;

    const policy = decideMindmapStateLoadPolicy(this.filePath, this.hasLeafState);
    if (policy === "await-state") {
      return;
    }
    if (policy === "activate-default") {
      await this.plugin.activateView();
      return;
    }

    const filePath = this.filePath;
    if (!filePath) return;

    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      new Notice(`找不到思维导图文件：${filePath}`);
      this.render();
      return;
    }

    const previousSelectedId = this.selectedNodeId;
    this.root = await this.plugin.readMindmapFile(file);
    if (applyPendingBodyEdits(this.root, this.pendingBodyEdits.values()) > 0 && this.plugin.getExpandListItems()) {
      applyListItemExpansion(this.root, { expandListItems: true });
    }
    this.currentFile = file;
    this.viewport = resolveInitialViewportState(
      options.viewport ?? state.viewport,
      this.plugin.getStoredMindmapState(filePath)
    );
    const selectedFromState = getNodeIdByKey(this.root, this.selectedNodeKey);
    this.setSelectedNode(
      getSelectionAfterReload(
        this.root,
        previousSelectedId,
        selectedFromState,
        options.preserveSelection
      )
    );
    this.render();
  }

  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    this.destroyBodyEditor();
    container.empty();
    container.addClass("heading-mindmap-view");
    container.setAttr("tabindex", "0");
    container.onkeydown = (event: KeyboardEvent) => {
      event.stopPropagation();
      this.handleKeydown(event);
    };

    const toolbar = container.createDiv({ cls: "heading-mindmap-toolbar" });
    this.createToolbar(toolbar);

    const split = container.createDiv({ cls: "heading-mindmap-split" });

    this.canvasEl = split.createDiv({ cls: "heading-mindmap-canvas" });
    this.canvasEl.tabIndex = 0;
    this.canvasEl.onkeydown = (event) => {
      event.stopPropagation();
      this.handleKeydown(event);
    };
    this.canvasEl.onclick = () => {
      this.focusCanvas();
    };
    this.canvasEl.onscroll = () => {
      this.scheduleUiStateSave();
    };
    this.renderCanvas(this.canvasEl);

    this.renderBodyPane(split);
  }

  private createToolbar(toolbar: HTMLElement): void {
    const title = toolbar.createDiv({ cls: "heading-mindmap-toolbar-title" });
    title.createSpan({ text: this.currentFile?.basename ?? "思维导图" });
    title.createEl("small", { text: this.currentFile?.path ?? "选择或创建一个 Markdown 导图文件" });

    const actions = toolbar.createDiv({ cls: "heading-mindmap-toolbar-actions" });
    const listToggleLabel = actions.createEl("label", { cls: "heading-mindmap-toolbar-toggle" });
    const listToggle = listToggleLabel.createEl("input", { type: "checkbox" });
    listToggle.checked = this.plugin.getExpandListItems();
    listToggle.onchange = () => {
      void this.setListItemExpansion(listToggle.checked);
    };
    listToggleLabel.createSpan({ text: "列表项" });
    setTooltip(listToggleLabel, "在导图中显示当前节点正文里的 Markdown 列表项");

    new ButtonComponent(actions)
      .setIcon("file-plus")
      .setTooltip("添加 Markdown 文件节点")
      .onClick(() => {
        this.openFilePicker();
      });
  }

  private renderCanvas(canvas: HTMLElement): void {
    const layout = layoutMindmap(this.root);
    canvas.style.setProperty("--mindmap-width", `${layout.width}px`);
    canvas.style.setProperty("--mindmap-height", `${layout.height}px`);
    canvas.onwheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      this.setScale(this.viewport.scale + (event.deltaY > 0 ? -0.1 : 0.1));
    };

    const scrollArea = canvas.createDiv({ cls: "heading-mindmap-scroll-area" });
    scrollArea.style.width = `${getStableScrollAreaSize(
      layout.width * this.viewport.scale,
      this.viewport.scrollLeft,
      canvas.clientWidth
    )}px`;
    scrollArea.style.height = `${getStableScrollAreaSize(
      layout.height * this.viewport.scale,
      this.viewport.scrollTop,
      canvas.clientHeight
    )}px`;

    const surface = scrollArea.createDiv({ cls: "heading-mindmap-surface" });
    this.surfaceEl = surface;
    surface.style.width = `${layout.width}px`;
    surface.style.height = `${layout.height}px`;
    surface.style.transform = `scale(${this.viewport.scale})`;

    const svg = surface.createSvg("svg", {
      cls: "heading-mindmap-edges",
      attr: {
        width: String(layout.width),
        height: String(layout.height)
      }
    });

    const nodePositions = new Map(layout.nodes.map((node) => [node.id, node]));
    for (const edge of layout.edges) {
      const from = nodePositions.get(edge.from);
      const to = nodePositions.get(edge.to);
      if (!from || !to) continue;

      const startX = from.x + layoutConstants.nodeWidth;
      const startY = from.y + layoutConstants.nodeHeight / 2;
      const endX = to.x;
      const endY = to.y + layoutConstants.nodeHeight / 2;
      const midX = (startX + endX) / 2;

      svg.createSvg("path", {
        attr: {
          d: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
          class: "heading-mindmap-edge"
        }
      });
    }

    for (const layoutNode of layout.nodes) {
      this.renderNode(surface, layoutNode.node, layoutNode.x, layoutNode.y);
    }

    restoreViewportScroll(canvas, this.viewport);
  }

  private renderNode(surface: HTMLElement, node: MindNode, x: number, y: number): void {
    const el = surface.createDiv({
      cls: [
        "heading-mindmap-node",
        `is-${node.type}`,
        node.id === this.selectedNodeId ? "is-selected" : ""
      ].join(" ")
    });
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.dataset.nodeId = node.id;
    el.tabIndex = 0;
    el.onclick = (event) => {
      event.stopPropagation();
      if (!shouldChangeSelectedNode(this.selectedNodeId, node.id)) {
        this.focusCanvas();
        return;
      }
      this.setSelectedNode(node.id);
      this.updateSelectionView();
      this.focusCanvas();
    };
    el.ondblclick = () => {
      if (node.type === "file") {
        void this.toggleFileOutline(node);
        return;
      }
      this.toggleNodeChildrenFold(node);
    };

    const header = el.createDiv({ cls: "heading-mindmap-node-header" });
    if (this.titleEditingNodeId === node.id) {
      const input = header.createEl("input", {
        type: "text",
        cls: "heading-mindmap-node-title-input"
      });
      input.value = node.title;
      input.onclick = (event) => event.stopPropagation();
      input.ondblclick = (event) => event.stopPropagation();
      input.onkeydown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void this.commitTitleEdit(node, input.value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          this.titleEditingNodeId = null;
          this.renderPreservingViewport({ focusCanvas: true });
        }
      };
      input.onblur = () => {
        void this.commitTitleEdit(node, input.value);
      };
      window.setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    } else {
      const titleEl = header.createSpan({ text: node.title, cls: "heading-mindmap-node-title" });
      titleEl.onclick = (event) => {
        event.stopPropagation();
        if (!shouldChangeSelectedNode(this.selectedNodeId, node.id)) {
          this.focusCanvas();
          return;
        }
        this.setSelectedNode(node.id);
        this.updateSelectionView();
        this.focusCanvas();
      };
    }
    header.createSpan({ text: this.getNodeBadge(node), cls: "heading-mindmap-node-badge" });
  }

  private async toggleFileOutline(node: MindNode): Promise<void> {
    if (!node.filePath) {
      new Notice("此文件节点缺少文件路径。");
      return;
    }

    if (node.outlineExpanded) {
      const viewport = this.readViewportFromDom();
      node.children = [];
      node.outlineExpanded = false;
      node.childrenCollapsed = false;
      this.setSelectedNode(getSelectionAfterSubtreeRemoval(this.root, this.selectedNodeId, node.id));
      await this.saveUiState(viewport);
      this.renderPreservingViewport({ focusCanvas: true, viewport });
      return;
    }

    const viewport = this.readViewportFromDom();
    const file = this.plugin.resolveFileNodeTarget(node, this.currentFile?.path ?? "");
    if (!(file instanceof TFile)) {
      new Notice(`找不到 Markdown 文件：${node.filePath}`);
      return;
    }

    node.children = buildOutlineTreeFromMarkdown(file.path, await this.plugin.app.vault.read(file));
    node.outlineExpanded = true;
    node.childrenCollapsed = false;

    if (node.children.length === 0) {
      new Notice("此文件没有可展开的 Markdown 标题。");
    }

    await this.saveUiState(viewport);
    this.renderPreservingViewport({ focusCanvas: true, viewport });
  }

  private getNodeBadge(node: MindNode): string {
    if (node.type === "file") return "MD";
    if (node.type === "heading") return `H${node.headingLevel ?? ""}`;
    if (node.type === "list-item") return "LIST";
    return "TEXT";
  }

  private getSelectedNode(): MindNode {
    return findNode(this.root, this.selectedNodeId) ?? this.root;
  }

  private findExpandedFileNode(filePath: string): MindNode | null {
    const stack = [this.root];
    while (stack.length > 0) {
      const node = stack.shift();
      if (!node) continue;
      const file = node.type === "file" && node.outlineExpanded
        ? this.plugin.resolveFileNodeTarget(node, this.currentFile?.path ?? "")
        : null;
      if (file?.path === filePath) {
        return node;
      }
      stack.unshift(...node.children);
    }
    return null;
  }

  private async saveAndRender(options: { focusCanvas?: boolean; viewport?: MindmapViewportState } = {}): Promise<void> {
    const viewport = options.viewport ?? this.readViewportFromDom();
    await this.saveUiState(viewport);
    try {
      await this.persistCurrentMindmap();
      this.renderPreservingViewport(options);
    } catch {
      new Notice("保存思维导图失败，请检查文件是否可写。");
    }
  }

  private async persistCurrentMindmap(): Promise<void> {
    if (!this.currentFile) return;
    const file = this.currentFile;
    const root = this.root;
    const save = this.saveQueue.then(() => this.plugin.persistMindmap(file, root));
    this.saveQueue = save.catch(() => undefined);
    await save;
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (this.shouldIgnoreShortcut(event)) return;

    const action = getMindmapShortcutAction(event);
    if (!action) return;

    event.preventDefault();

    if (action.type === "move-sibling") {
      this.applyOperation(moveNodeWithinSiblings(this.root, this.selectedNodeId, action.direction));
      return;
    }

    if (action.type === "select") {
      const update = getSelectionUpdate(
        this.selectedNodeId,
        getDirectionalNodeId(this.root, this.selectedNodeId, action.direction)
      );
      if (!update.changed) {
        this.focusCanvas();
        return;
      }
      this.setSelectedNode(update.selectedNodeId);
      this.updateSelectionView();
      this.focusCanvas();
      return;
    }

    if (action.type === "promote") {
      this.applyOperation(promoteNode(this.root, this.selectedNodeId));
      return;
    }

    if (action.type === "add-child") {
      this.applyOperation(addChildNode(this.root, this.selectedNodeId, "新节点"));
      return;
    }

    if (action.type === "add-sibling") {
      this.applyOperation(addSiblingNode(this.root, this.selectedNodeId, "新节点"));
      return;
    }

    if (action.type === "focus-body") {
      this.focusBodyEditor();
      return;
    }

    if (action.type === "edit-title") {
      this.startTitleEdit();
      return;
    }

    if (action.type === "toggle-fold") {
      this.toggleSelectedNodeFold();
      return;
    }

    if (action.type === "delete") {
      this.applyOperation(deleteNode(this.root, this.selectedNodeId));
    }
  }

  private handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.shouldIgnoreShortcut(event)) return;
    if (!this.shouldHandleDocumentShortcut(event)) return;
    this.handleKeydown(event);
  }

  private applyOperation(result: OperationResult, persist = true): void {
    if (!result.ok) {
      new Notice(result.message);
      if (result.selectedNodeId) {
        this.setSelectedNode(result.selectedNodeId);
      }
      return;
    }

    this.setSelectedNode(result.selectedNodeId);
    if (result.message) {
      new Notice(result.message);
    }

    if (persist) {
      const viewport = this.readViewportFromDom();
      void this.saveAndRender({ focusCanvas: true, viewport });
    } else {
      const viewport = this.readViewportFromDom();
      void this.saveUiState(viewport).then(() => this.renderPreservingViewport({ focusCanvas: true, viewport }));
    }
  }

  private toggleSelectedNodeFold(): void {
    this.applyOperation(toggleNodeFold(this.root, this.selectedNodeId), false);
  }

  private toggleNodeChildrenFold(node: MindNode): void {
    const viewport = this.readViewportFromDom();
    node.childrenCollapsed = !node.childrenCollapsed;
    this.setSelectedNode(node.id);
    void this.saveUiState(viewport).then(() => this.renderPreservingViewport({ focusCanvas: true, viewport }));
  }

  private setScale(scale: number): void {
    this.viewport = normalizeViewportState({
      ...this.readViewportFromDom(),
      scale
    });
    const layout = layoutMindmap(this.root);
    const scrollArea = this.surfaceEl?.parentElement;
    if (scrollArea) {
      scrollArea.style.width = `${layout.width * this.viewport.scale}px`;
      scrollArea.style.height = `${layout.height * this.viewport.scale}px`;
    }
    if (this.surfaceEl) {
      this.surfaceEl.style.transform = `scale(${this.viewport.scale})`;
    }
    this.scheduleUiStateSave();
  }

  private readViewportFromDom(): MindmapViewportState {
    return normalizeViewportState({
      scale: this.viewport.scale,
      scrollLeft: this.canvasEl?.scrollLeft ?? this.viewport.scrollLeft,
      scrollTop: this.canvasEl?.scrollTop ?? this.viewport.scrollTop
    });
  }

  private scheduleUiStateSave(): void {
    if (this.saveStateTimer !== null) {
      window.clearTimeout(this.saveStateTimer);
    }
    this.saveStateTimer = window.setTimeout(() => {
      this.saveStateTimer = null;
      void this.saveUiState();
    }, 200);
  }

  private async saveUiState(viewport = this.readViewportFromDom()): Promise<void> {
    if (!this.filePath) return;
    this.viewport = viewport;
    this.selectedNodeKey = getNodeKey(this.root, this.selectedNodeId) ?? undefined;
    this.plugin.app.workspace.requestSaveLayout();
    await this.plugin.saveMindmapState(this.filePath, this.root, this.viewport);
  }

  private startTitleEdit(): void {
    const editable = canEditNodeTitle(this.root, this.selectedNodeId);
    if (!editable.ok) {
      new Notice(editable.message);
      return;
    }
    this.titleEditingNodeId = this.selectedNodeId;
    this.renderPreservingViewport();
  }

  private async commitTitleEdit(node: MindNode, value: string): Promise<void> {
    if (this.titleEditingNodeId !== node.id) return;
    this.titleEditingNodeId = null;
    const nextTitle = value.trim() || "未命名节点";
    if (nextTitle !== node.title) {
      node.title = nextTitle;
      await this.saveAndRender({ focusCanvas: true });
      return;
    }
    this.renderPreservingViewport({ focusCanvas: true });
  }

  private renderBodyPane(container: HTMLElement): void {
    const node = this.getSelectedNode();
    const readonly = isReadonlyOutlineNode(this.root, node.id);
    this.bodyPaneMode = normalizeBodyPaneMode(this.bodyPaneMode, readonly);

    const pane = container.createDiv({ cls: "heading-mindmap-body-pane" });
    const header = pane.createDiv({ cls: "heading-mindmap-body-header" });
    const heading = header.createDiv({ cls: "heading-mindmap-body-heading" });
    heading.createDiv({ text: node.title, cls: "heading-mindmap-body-title" });
    heading.createDiv({ text: this.getNodeBodyMeta(node), cls: "heading-mindmap-body-meta" });

    const actions = header.createDiv({ cls: "heading-mindmap-body-actions" });
    if (!readonly) {
      const modeButton = new ButtonComponent(actions)
        .setIcon(this.bodyPaneMode === "preview" ? "pencil" : "book-open")
        .setTooltip(this.bodyPaneMode === "preview" ? "切换到编辑视图" : "切换到阅读视图")
        .onClick(() => {
          modeButton.buttonEl.blur();
          void this.setBodyPaneMode(toggleBodyPaneMode(this.bodyPaneMode, false));
        });
      modeButton.buttonEl.addClass("heading-mindmap-body-mode-button");
    }

    if (this.bodyPaneMode === "source" && !readonly) {
      this.renderBodySource(pane, node);
    } else {
      this.renderBodyPreview(pane, node);
    }
  }

  private getNodeBodyMeta(node: MindNode): string {
    return getBodyPaneMeta(node, {
      currentFilePath: this.currentFile?.path ?? "",
      readonly: isReadonlyOutlineNode(this.root, node.id)
    });
  }

  private focusBodyEditor(): void {
    if (isReadonlyOutlineNode(this.root, this.selectedNodeId)) {
      new Notice(READONLY_OUTLINE_MESSAGE);
      return;
    }
    if (this.bodyPaneMode !== "source") {
      void this.setBodyPaneMode("source", { focusEditor: true });
      return;
    }
    this.bodyPaneModeRequestId = nextBodyPaneModeRequestId(this.bodyPaneModeRequestId);
    this.focusBodyEditorView();
    this.scheduleBodyEditorFocus();
  }

  private scheduleBodyPersist(): void {
    if (this.bodySaveTimer !== null) {
      window.clearTimeout(this.bodySaveTimer);
    }
    this.bodySaveTimer = window.setTimeout(() => {
      this.bodySaveTimer = null;
      void this.saveBodyWithoutRender();
    }, 500);
  }

  private async saveBodyWithoutRender(): Promise<void> {
    await this.saveUiState();
    try {
      await this.persistCurrentMindmap();
      this.pendingBodyEdits.clear();
    } catch {
      new Notice("保存正文失败，请检查文件是否可写。");
    }
  }

  private async saveBodyAfterEditing(): Promise<void> {
    if (this.bodySaveTimer !== null) {
      window.clearTimeout(this.bodySaveTimer);
      this.bodySaveTimer = null;
    }
    await this.saveBodyWithoutRender();
    if (this.plugin.getExpandListItems()) {
      this.renderPreservingViewport();
    }
  }

  private renderBodyPreview(container: HTMLElement, node: MindNode): void {
    this.destroyBodyEditor();
    const readingView = container.createDiv({
      cls: BODY_READING_VIEW_CLASSES
    });
    const preview = readingView.createDiv({
      cls: BODY_PREVIEW_CONTENT_CLASSES
    });
    this.previewEl = preview;
    void this.renderMarkdownPreview(node);
  }

  private renderBodySource(container: HTMLElement, node: MindNode): void {
    this.previewEl = undefined;
    this.destroyBodyEditor();

    const sourceWrap = container.createDiv({
      cls: BODY_SOURCE_VIEW_CLASSES
    });
    const editorHost = sourceWrap.createDiv({
      cls: BODY_EDITOR_HOST_CLASSES
    });

    const editorView = new EditorView({
      parent: editorHost,
      state: EditorState.create({
        doc: node.body,
        extensions: [
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                void this.saveBodyAfterEditing();
                return true;
              }
            }
          ]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            node.body = update.state.doc.toString();
            node.bodyCollapsed = false;
            const nodeKey = getNodeKey(this.root, node.id);
            if (nodeKey) {
              this.pendingBodyEdits.set(nodeKey, { nodeKey, body: node.body });
            }
            if (this.plugin.getExpandListItems()) {
              applyListItemExpansion(this.root, { expandListItems: true });
            }
            this.scheduleBodyPersist();
          })
        ]
      })
    });

    editorView.dom.onclick = (event) => event.stopPropagation();
    editorView.dom.onblur = () => {
      void this.saveBodyAfterEditing();
    };
    editorView.contentDOM.tabIndex = 0;
    this.bodyEditorView = editorView;
  }

  private async renderMarkdownPreview(node: MindNode): Promise<void> {
    const preview = this.previewEl;
    if (!preview) return;

    const version = ++this.previewRenderVersion;
    const renderTarget = preview.createDiv();
    const markdown = node.body;
    const sourcePath = getBodyPreviewSourcePath(node, this.currentFile?.path ?? "");
    if (!markdown.trim()) {
      preview.empty();
      preview.createDiv({ text: "当前节点没有正文。", cls: "heading-mindmap-body-empty" });
      return;
    }

    await MarkdownRenderer.render(this.plugin.app, markdown, renderTarget, sourcePath, this);
    if (version !== this.previewRenderVersion) return;
    preview.empty();
    preview.appendChild(renderTarget);
  }

  private destroyBodyEditor(): void {
    this.bodyEditorView?.destroy();
    this.bodyEditorView = undefined;
  }

  private async setBodyPaneMode(mode: BodyPaneMode, options: { focusEditor?: boolean } = {}): Promise<void> {
    const requestId = nextBodyPaneModeRequestId(this.bodyPaneModeRequestId);
    this.bodyPaneModeRequestId = requestId;
    const hasSourceEditor = Boolean(this.bodyEditorView);
    if (shouldSaveBodyBeforeModeChange(this.bodyPaneMode, mode, hasSourceEditor)) {
      await this.saveBodyAfterEditing();
    }
    if (!isLatestBodyPaneModeRequest(requestId, this.bodyPaneModeRequestId)) return;
    const shouldRender = shouldRenderBodyPaneMode(this.bodyPaneMode, mode, hasSourceEditor);
    this.bodyPaneMode = mode;
    if (shouldRender) {
      this.renderBodyPaneOnly();
    }
    if (options.focusEditor || mode === "source") {
      this.focusBodyEditorView();
      this.scheduleBodyEditorFocus();
      return;
    }
    window.setTimeout(() => this.focusCanvas(), 0);
  }

  private focusBodyEditorView(): void {
    const editor = this.bodyEditorView;
    if (!editor) return;
    editor.focus();
    if (!editor.hasFocus) {
      editor.contentDOM.focus({ preventScroll: true });
    }
    editor.dom.querySelector<HTMLElement>(".cm-content")?.focus({ preventScroll: true });
  }

  private scheduleBodyEditorFocus(): void {
    const focusUntilReady = (attempt: number) => {
      const editor = this.bodyEditorView;
      if (!editor) return;
      this.focusBodyEditorView();
      if (editor.hasFocus || editor.dom.classList.contains("cm-focused") || attempt >= 20) return;
      window.requestAnimationFrame(() => {
        window.setTimeout(() => focusUntilReady(attempt + 1), 50);
      });
    };
    window.requestAnimationFrame(() => focusUntilReady(0));
  }

  private renderBodyPaneOnly(): void {
    const split = this.canvasEl?.parentElement;
    const oldPane = split?.querySelector<HTMLElement>(".heading-mindmap-body-pane");
    if (!split || !oldPane) return;
    this.destroyBodyEditor();
    oldPane.remove();
    this.renderBodyPane(split);
  }

  private updateSelectionView(): void {
    const surface = this.surfaceEl;
    if (!surface) return;

    surface.querySelectorAll<HTMLElement>(".heading-mindmap-node.is-selected").forEach((nodeEl) => {
      nodeEl.removeClass("is-selected");
    });

    const selectedEl = surface.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(this.selectedNodeId)}"]`);
    selectedEl?.addClass("is-selected");

    const split = this.canvasEl?.parentElement;
    const oldPane = split?.querySelector<HTMLElement>(".heading-mindmap-body-pane");
    if (split && oldPane) {
      this.destroyBodyEditor();
      oldPane.remove();
      this.renderBodyPane(split);
    }
  }

  private focusCanvas(): void {
    this.canvasEl?.focus({ preventScroll: true });
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

    const activeEl = document.activeElement;
    return shouldHandleDocumentShortcutTarget({
      targetInsideView: this.containerEl.contains(target),
      targetInsideModal: Boolean(target.closest(".modal")),
      activeViewIsMindmap: this.plugin.app.workspace.getActiveViewOfType(HeadingMindmapView) === this,
      activeElementIsPageRoot: activeEl === document.body || activeEl === document.documentElement || activeEl === null
    });
  }

  private openFilePicker(): void {
    if (isReadonlyOutlineNode(this.root, this.selectedNodeId)) {
      new Notice(READONLY_OUTLINE_MESSAGE);
      return;
    }
    new MarkdownFilePickerModal(this.plugin, this.currentFile?.path, (file) => {
      this.applyOperation(addFileChildNode(this.root, this.selectedNodeId, file.path));
      this.focusCanvas();
    }).open();
  }

  async toggleListItemExpansion(): Promise<void> {
    await this.setListItemExpansion(!this.plugin.getExpandListItems());
  }

  private async setListItemExpansion(value: boolean): Promise<void> {
    const viewport = this.readViewportFromDom();
    await this.saveUiState(viewport);
    await this.plugin.setExpandListItems(value);
    await this.loadFromState({ preserveSelection: true, viewport });
    this.selectedNodeKey = getNodeKey(this.root, this.selectedNodeId) ?? undefined;
    this.focusCanvas();
  }

  private renderPreservingViewport(options: { focusCanvas?: boolean; viewport?: MindmapViewportState } = {}): void {
    this.viewport = preserveViewportForRender(this.viewport, options.viewport ?? this.readViewportFromDom());
    this.render();
    if (options.focusCanvas) {
      window.setTimeout(() => this.focusCanvas(), 0);
    }
  }
}
