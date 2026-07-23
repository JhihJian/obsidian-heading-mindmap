import { Modal, type App } from "obsidian";
import { MINDMAP_SHORTCUT_HELP } from "./mindmap-shortcut-help";

export class MindmapShortcutHelpModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("快捷键速查");
    this.contentEl.empty();

    const table = this.contentEl.createEl("table", { cls: "heading-mindmap-shortcut-table" });
    const header = table.createEl("thead").createEl("tr");
    header.createEl("th", { text: "快捷键" });
    header.createEl("th", { text: "操作" });

    const body = table.createEl("tbody");
    for (const item of MINDMAP_SHORTCUT_HELP) {
      const row = body.createEl("tr");
      row.createEl("td").createEl("kbd", { text: item.keys });
      row.createEl("td", { text: item.action });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
