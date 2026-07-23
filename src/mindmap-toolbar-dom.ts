import { ButtonComponent, setTooltip } from "obsidian";

export interface MindmapToolbarOptions {
  title: string;
  path: string;
  scale: number;
  expandListItems: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFitToView: () => void;
  onResetZoom: () => void;
  onToggleListItems: (value: boolean) => void;
  onAddFileNode: () => void;
  onShowShortcutHelp: () => void;
}

export function renderMindmapToolbar(toolbar: HTMLElement, options: MindmapToolbarOptions): void {
  const title = toolbar.createDiv({ cls: "heading-mindmap-toolbar-title" });
  title.createSpan({ text: options.title });
  title.createEl("small", { text: options.path });

  const actions = toolbar.createDiv({ cls: "heading-mindmap-toolbar-actions" });
  const zoomControls = actions.createDiv({ cls: "heading-mindmap-zoom-controls" });
  renderToolbarButton(zoomControls, "minus", "缩小导图", options.onZoomOut);
  const zoomLabel = zoomControls.createSpan({
    text: `${Math.round(options.scale * 100)}%`,
    cls: "heading-mindmap-zoom-label"
  });
  zoomLabel.setAttr("aria-label", `当前缩放 ${Math.round(options.scale * 100)}%`);
  renderToolbarButton(zoomControls, "plus", "放大导图", options.onZoomIn);
  renderToolbarButton(zoomControls, "maximize", "适配窗口查看全图", options.onFitToView);
  renderToolbarButton(zoomControls, "rotate-ccw", "缩放到 100%", options.onResetZoom);

  const listToggleLabel = actions.createEl("label", { cls: "heading-mindmap-toolbar-toggle" });
  const listToggle = listToggleLabel.createEl("input", { type: "checkbox" });
  listToggle.checked = options.expandListItems;
  listToggle.onchange = () => {
    options.onToggleListItems(listToggle.checked);
  };
  listToggleLabel.createSpan({ text: "列表项" });
  setTooltip(listToggleLabel, "在导图中显示当前节点正文里的 Markdown 列表项");

  renderToolbarButton(actions, "file-plus", "添加 Markdown 文件节点", options.onAddFileNode);
  renderToolbarButton(actions, "keyboard", "查看快捷键速查表", options.onShowShortcutHelp);
}

function renderToolbarButton(
  container: HTMLElement,
  icon: string,
  tooltip: string,
  onClick: () => void
): ButtonComponent {
  const button = new ButtonComponent(container)
    .setIcon(icon)
    .setTooltip(tooltip)
    .onClick(onClick);
  button.buttonEl.setAttr("aria-label", tooltip);
  return button;
}
