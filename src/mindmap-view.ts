import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_MINDMAP, type MindmapViewState } from "./mindmap-view-config";
import { MindmapViewActions } from "./mindmap-view-actions";
import { MindmapViewLoader } from "./mindmap-view-loader";
import { MindmapViewPersistence } from "./mindmap-view-persistence";
import { MindmapViewRenderer } from "./mindmap-view-renderer";
import { MindmapViewStore } from "./mindmap-view-store";
import type HeadingMindmapPlugin from "./main";

export class HeadingMindmapView extends ItemView {
  private readonly store: MindmapViewStore;
  private readonly renderer: MindmapViewRenderer;
  private readonly persistence: MindmapViewPersistence;
  private readonly actions: MindmapViewActions;
  private readonly loader: MindmapViewLoader;

  constructor(leaf: WorkspaceLeaf, plugin: HeadingMindmapPlugin) {
    super(leaf);
    this.store = new MindmapViewStore(plugin, this);
    this.renderer = new MindmapViewRenderer(this.store, this.containerEl);
    this.persistence = new MindmapViewPersistence(this.store, this.renderer);
    this.actions = new MindmapViewActions(
      this.store,
      this.renderer,
      this.persistence,
      this.containerEl,
      () => plugin.app.workspace.getActiveViewOfType(HeadingMindmapView) === this ? this : null
    );
    this.loader = new MindmapViewLoader(this.store, this.renderer, this.persistence);
    this.renderer.actions = this.actions;
    this.renderer.persistence = this.persistence;
    this.actions.loader = this.loader;
  }

  getViewType(): string {
    return VIEW_TYPE_MINDMAP;
  }

  getDisplayText(): string {
    return this.store.currentFile?.basename ?? "Heading Mindmap";
  }

  getIcon(): string {
    return "git-fork";
  }

  onOpen(): Promise<void> {
    this.registerDomEvent(activeDocument, "keydown", (event) => {
      this.actions.handleDocumentKeydown(event);
    });
    return Promise.resolve();
  }

  async onClose(): Promise<void> {
    await this.persistence.close();
  }

  getState(): Record<string, unknown> {
    return this.loader.getState();
  }

  async setState(state: MindmapViewState, result: { history: boolean }): Promise<void> {
    await super.setState(state, result);
    await this.loader.setState(state);
  }

  matchesFile(filePath: string): boolean {
    return this.loader.matchesFile(filePath);
  }

  getFilePath(): string | undefined {
    return this.loader.getFilePath();
  }

  usesExpandedFile(filePath: string): boolean {
    return this.loader.usesExpandedFile(filePath);
  }

  async refreshExpandedFile(file: TFile): Promise<void> {
    await this.loader.refreshExpandedFile(file);
  }

  async reloadFromDisk(): Promise<void> {
    await this.loader.reloadFromDisk();
  }

  async toggleListItemExpansion(): Promise<void> {
    await this.actions.toggleListItemExpansion();
  }
}
