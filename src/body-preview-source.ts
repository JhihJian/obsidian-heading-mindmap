import type { MindNode } from "./mindmap-model";

export function getBodyPreviewSourcePath(node: MindNode, currentFilePath: string): string {
  return node.filePath ?? currentFilePath;
}
