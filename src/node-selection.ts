import { findNode } from "./mindmap-navigation";
import type { MindNode } from "./mindmap-model";
import { isReadonlyOutlineNode } from "./mindmap-operations";

export function shouldChangeSelectedNode(currentNodeId: string, nextNodeId: string): boolean {
  return currentNodeId !== nextNodeId;
}

export function getSelectionUpdate(
  currentNodeId: string,
  nextNodeId: string
): { changed: boolean; selectedNodeId: string } {
  return {
    changed: shouldChangeSelectedNode(currentNodeId, nextNodeId),
    selectedNodeId: nextNodeId
  };
}

export function getSelectionAfterSubtreeRemoval(
  root: MindNode,
  selectedNodeId: string,
  fallbackNodeId: string
): string {
  if (findNode(root, selectedNodeId)) return selectedNodeId;
  return findNode(root, fallbackNodeId)?.id ?? root.id;
}

export function getSelectionAfterReload(
  root: MindNode,
  previousSelectedNodeId: string,
  selectedFromStateNodeId: string | null | undefined,
  preserveSelection: boolean | undefined
): string {
  if (
    preserveSelection &&
    findNode(root, previousSelectedNodeId) &&
    !isReadonlyOutlineNode(root, previousSelectedNodeId)
  ) {
    return previousSelectedNodeId;
  }
  if (
    selectedFromStateNodeId &&
    findNode(root, selectedFromStateNodeId) &&
    !isReadonlyOutlineNode(root, selectedFromStateNodeId)
  ) {
    return selectedFromStateNodeId;
  }
  return root.id;
}
