import { ButtonComponent, setTooltip } from "obsidian";

export interface MindmapToolbarOptions {
  title: string;
  path: string;
  expandListItems: boolean;
  onToggleListItems: (value: boolean) => void;
  onAddFileNode: () => void;
}

export function renderMindmapToolbar(toolbar: HTMLElement, options: MindmapToolbarOptions): void {
  const title = toolbar.createDiv({ cls: "heading-mindmap-toolbar-title" });
  title.createSpan({ text: options.title });
  title.createEl("small", { text: options.path });

  const actions = toolbar.createDiv({ cls: "heading-mindmap-toolbar-actions" });
  const listToggleLabel = actions.createEl("label", { cls: "heading-mindmap-toolbar-toggle" });
  const listToggle = listToggleLabel.createEl("input", { type: "checkbox" });
  listToggle.checked = options.expandListItems;
  listToggle.onchange = () => {
    options.onToggleListItems(listToggle.checked);
  };
  listToggleLabel.createSpan({ text: "列表项" });
  setTooltip(listToggleLabel, "在导图中显示当前节点正文里的 Markdown 列表项");

  new ButtonComponent(actions)
    .setIcon("file-plus")
    .setTooltip("添加 Markdown 文件节点")
    .onClick(() => {
      options.onAddFileNode();
    });
}
