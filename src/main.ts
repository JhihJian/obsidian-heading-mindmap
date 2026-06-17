import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { chooseMindmapSourcePath } from "./active-mindmap-file";
import { resolveFileNodePath } from "./file-node-target";
import {
  buildOutlineTreeFromMarkdown,
  createStarterMindmap,
  getFileTitle,
  parseMindmapMarkdown,
  serializeMindmapMarkdown,
  type MindNode
} from "./mindmap-model";
import {
  applyStoredMindmapState,
  collectStoredMindmapState,
  type MindmapViewportState,
  type StoredMindmapState
} from "./mindmap-view-state";
import { DEFAULT_MINDMAP_PATH, VIEW_TYPE_MINDMAP, type MindmapViewState } from "./mindmap-view-config";
import { HeadingMindmapView } from "./mindmap-view";
import { normalizePluginData, type HeadingMindmapPluginData } from "./plugin-data";
import { decideMindmapOpenPolicy } from "./view-open-policy";

export default class HeadingMindmapPlugin extends Plugin {
  private data: HeadingMindmapPluginData = { files: {}, expandListItems: false };
  private persistCount = 0;

  async onload(): Promise<void> {
    this.data = normalizePluginData(await this.loadData());

    this.registerView(
      VIEW_TYPE_MINDMAP,
      (leaf) => new HeadingMindmapView(leaf, this)
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (this.persistCount > 0) return;
        if (file instanceof TFile) {
          void this.refreshViewsForFile(file);
        }
      })
    );

    this.addRibbonIcon("git-fork", "打开思维导图", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open",
      name: "打开思维导图",
      callback: () => {
        void this.activateView();
      }
    });

    this.addCommand({
      id: "toggle-list-item-expansion",
      name: "切换正文列表项在导图中展示",
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(HeadingMindmapView);
        if (!view) return;
        return view.toggleListItemExpansion();
      }
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_MINDMAP);
  }

  async activateView(): Promise<void> {
    const file = await this.getActiveOrDefaultMindmapFile();
    const activeView = this.app.workspace.getActiveViewOfType(HeadingMindmapView);
    const policy = decideMindmapOpenPolicy(activeView ? { filePath: activeView.getFilePath() } : null, file.path);
    const leaf = policy === "reuse-current-mindmap" ? activeView!.leaf : this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_MINDMAP,
      active: true,
      state: { filePath: file.path } satisfies MindmapViewState
    });
    this.app.workspace.revealLeaf(leaf);
  }

  async readMindmapFile(file: TFile): Promise<MindNode> {
    const markdown = await this.app.vault.read(file);
    const root = parseMindmapMarkdown(file.path, markdown, {
      expandListItems: this.data.expandListItems
    });
    applyStoredMindmapState(root, this.data.files[file.path]);
    await this.restoreExpandedFileOutlines(root, file.path);
    return root;
  }

  getExpandListItems(): boolean {
    return this.data.expandListItems;
  }

  async setExpandListItems(value: boolean): Promise<void> {
    if (this.data.expandListItems === value) return;
    this.data.expandListItems = value;
    await this.saveData(this.data);
  }

  async persistMindmap(file: TFile, root: MindNode): Promise<void> {
    this.persistCount += 1;
    try {
      await this.app.vault.modify(file, serializeMindmapMarkdown(root));
    } finally {
      this.persistCount -= 1;
    }
  }

  getStoredMindmapState(filePath: string): StoredMindmapState | undefined {
    return this.data.files[filePath];
  }

  async saveMindmapState(
    filePath: string,
    root: MindNode,
    viewport?: Partial<MindmapViewportState>
  ): Promise<void> {
    this.data.files[filePath] = collectStoredMindmapState(root, viewport);
    await this.saveData(this.data);
  }

  resolveFileNodeTarget(node: MindNode, sourcePath = node.filePath ?? ""): TFile | null {
    if (!node.filePath) return null;
    const resolved = this.app.metadataCache.getFirstLinkpathDest(node.filePath, sourcePath);
    const targetPath = resolveFileNodePath(node.filePath, resolved?.path);
    const target = this.app.vault.getAbstractFileByPath(targetPath);
    if (!(target instanceof TFile)) return null;
    node.filePath = target.path;
    node.title = getFileTitle(target.path);
    return target;
  }

  private async refreshViewsForFile(file: TFile): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MINDMAP);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof HeadingMindmapView && view.matchesFile(file.path)) {
        await view.reloadFromDisk();
      } else if (view instanceof HeadingMindmapView && view.usesExpandedFile(file.path)) {
        await view.refreshExpandedFile(file);
      }
    }
  }

  private async restoreExpandedFileOutlines(node: MindNode, sourcePath: string): Promise<void> {
    if (node.type === "file" && node.outlineExpanded && node.filePath) {
      const file = this.resolveFileNodeTarget(node, sourcePath);
      if (file instanceof TFile) {
        node.children = buildOutlineTreeFromMarkdown(file.path, await this.app.vault.read(file));
      } else {
        node.outlineExpanded = false;
      }
    }

    for (const child of node.children) {
      await this.restoreExpandedFileOutlines(child, sourcePath);
    }
  }

  private async getActiveOrDefaultMindmapFile(): Promise<TFile> {
    const activeMindmap = this.app.workspace.getActiveViewOfType(HeadingMindmapView);
    const activeFile = this.app.workspace.getActiveFile();
    const sourcePath = chooseMindmapSourcePath(
      activeMindmap?.getFilePath(),
      activeFile ? { path: activeFile.path, extension: activeFile.extension } : null,
      DEFAULT_MINDMAP_PATH
    );

    const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
    if (sourceFile instanceof TFile) {
      return sourceFile;
    }

    const existing = this.app.vault.getAbstractFileByPath(DEFAULT_MINDMAP_PATH);
    if (existing instanceof TFile) {
      return existing;
    }

    await this.ensureFolder("Mindmaps");
    return this.app.vault.create(
      DEFAULT_MINDMAP_PATH,
      serializeMindmapMarkdown(createStarterMindmap())
    );
  }

  private async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (await this.app.vault.adapter.exists(normalized)) return;
    await this.app.vault.createFolder(normalized);
  }
}
