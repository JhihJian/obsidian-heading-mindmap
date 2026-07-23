import { FuzzySuggestModal, type TFile } from "obsidian";
import { getFileNodeOptions } from "./markdown-file-options";
import type HeadingMindmapPlugin from "./main";

export class MarkdownFilePickerModal extends FuzzySuggestModal<TFile> {
  private readonly markdownFiles: TFile[];
  private readonly onChoose: (file: TFile) => void;

  constructor(plugin: HeadingMindmapPlugin, currentFilePath: string | undefined, onChoose: (file: TFile) => void) {
    super(plugin.app);
    this.markdownFiles = getFileNodeOptions(plugin.app.vault.getMarkdownFiles(), currentFilePath);
    this.onChoose = onChoose;
    this.emptyStateText = "没有匹配的 Markdown 文件";
  }

  async onOpen(): Promise<void> {
    await super.onOpen();
    this.setPlaceholder("搜索 Markdown 文件路径");
    this.inputEl.setAttr("aria-label", "搜索 Markdown 文件");
  }

  getItems(): TFile[] {
    return this.markdownFiles;
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
