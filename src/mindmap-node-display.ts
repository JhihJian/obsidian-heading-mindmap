import type { MindNode } from "./mindmap-model";

export function getNodeBadge(node: MindNode): string {
  if (node.type === "document") return "DOC";
  if (node.type === "file") return "MD";
  if (node.type === "heading") return `H${node.headingLevel ?? ""}`;
  if (node.type === "list-item") return "LIST";
  return "TEXT";
}
