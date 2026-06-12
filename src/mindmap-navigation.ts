import type { MindNode } from "./mindmap-model";

export type MindmapDirection = "up" | "down" | "left" | "right";

export function getDirectionalNodeId(
  root: MindNode,
  selectedNodeId: string,
  direction: MindmapDirection
): string {
  const current = findNode(root, selectedNodeId);
  if (!current) return root.id;

  if (direction === "right") {
    if (current.childrenCollapsed) return current.id;
    return current.children[0]?.id ?? current.id;
  }

  if (direction === "left") {
    return findParentNode(root, current.id)?.id ?? current.id;
  }

  const parent = findParentNode(root, current.id);
  if (!parent) return current.id;

  const siblings = parent.children;
  const index = siblings.findIndex((node) => node.id === current.id);
  if (index === -1) return current.id;

  const offset = direction === "up" ? -1 : 1;
  return siblings[index + offset]?.id ?? current.id;
}

export function findNode(root: MindNode, id: string): MindNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findParentNode(root: MindNode, id: string): MindNode | null {
  if (root.childrenCollapsed) return null;
  for (const child of root.children) {
    if (child.id === id) return root;
    const found = findParentNode(child, id);
    if (found) return found;
  }
  return null;
}
