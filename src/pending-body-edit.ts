import type { MindNode } from "./mindmap-model";
import { getNodeIdByKey } from "./mindmap-view-state";
import { findNode } from "./mindmap-navigation";

export type PendingBodyEdit = {
  nodeKey: string;
  body: string;
};

export function applyPendingBodyEdit(root: MindNode, pending: PendingBodyEdit | null): boolean {
  if (!pending) return false;
  const nodeId = getNodeIdByKey(root, pending.nodeKey);
  if (!nodeId) return false;
  const node = findNode(root, nodeId);
  if (!node) return false;
  node.body = pending.body;
  node.bodyCollapsed = false;
  return true;
}

export function applyPendingBodyEdits(root: MindNode, pendingEdits: Iterable<PendingBodyEdit>): number {
  let applied = 0;
  for (const pending of pendingEdits) {
    if (applyPendingBodyEdit(root, pending)) {
      applied += 1;
    }
  }
  return applied;
}
