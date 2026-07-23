export interface MindmapShortcutHelpItem {
  keys: string;
  action: string;
}

export const MINDMAP_SHORTCUT_HELP: readonly MindmapShortcutHelpItem[] = [
  { keys: "↑ / ↓", action: "移动到上一个或下一个同级节点" },
  { keys: "← / →", action: "移动到父节点或第一个子节点" },
  { keys: "Enter", action: "编辑选中节点标题" },
  { keys: "Ctrl/Cmd + Enter", action: "聚焦正文编辑区" },
  { keys: "Tab", action: "新建子节点" },
  { keys: "Shift + Enter", action: "新建同级节点" },
  { keys: "Shift + Tab", action: "升级当前节点" },
  { keys: "Alt + ↑ / ↓", action: "调整同级节点顺序" },
  { keys: "Space", action: "折叠或展开当前节点子树" },
  { keys: "Delete", action: "删除当前节点" }
];
