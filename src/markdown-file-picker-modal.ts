import { Modal, Setting, TFile } from "obsidian";
import { getFileNodeOptions } from "./markdown-file-options";
import type HeadingMindmapPlugin from "./main";

export class MarkdownFilePickerModal extends Modal {
  private plugin: HeadingMindmapPlugin;
  private currentFilePath?: string;
  private onChoose: (file: TFile) => void;

  constructor(plugin: HeadingMindmapPlugin, currentFilePath: string | undefined, onChoose: (file: TFile) => void) {
    super(plugin.app);
    this.plugin = plugin;
    this.currentFilePath = currentFilePath;
    this.onChoose = onChoose;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "选择 Markdown 文件" });

    const markdownFiles = getFileNodeOptions(this.plugin.app.vault.getMarkdownFiles(), this.currentFilePath);
    new Setting(contentEl)
      .setName("文件路径")
      .setDesc("选择后会在当前选中节点下新增一个文件节点。")
      .addDropdown((dropdown) => {
        for (const file of markdownFiles) {
          dropdown.addOption(file.path, file.path);
        }
        dropdown.onChange((value) => {
          const file = this.plugin.app.vault.getAbstractFileByPath(value);
          if (file instanceof TFile) {
            this.onChoose(file);
            this.close();
          }
        });
      });

    if (markdownFiles.length === 0) {
      contentEl.createEl("p", { text: "当前库里没有可添加的其他 Markdown 文件。" });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
