import type { MindNode } from "./mindmap-model";

export function getBodyPaneMeta(
  node: MindNode,
  options: { currentFilePath: string; readonly: boolean }
): string {
  if (node.type === "list-item") return "正文列表项预览";
  if (options.readonly) {
    return node.filePath ? `只读预览 · ${node.filePath}` : "只读预览";
  }
  if (node.type === "file") return node.filePath ?? "Markdown 文件节点";
  return options.currentFilePath;
}
