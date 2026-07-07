import { getMindmapShortcutAction } from "./keyboard-shortcuts";
import type { MindNode } from "./mindmap-model";
import { getDirectionalNodeId } from "./mindmap-navigation";
import {
  addChildNode,
  addSiblingNode,
  deleteNode,
  moveNodeWithinSiblings,
  promoteNode,
  toggleNodeFold,
  type OperationResult
} from "./mindmap-operations";
import { getSelectionUpdate } from "./node-selection";

export interface MindmapShortcutDispatchContext {
  root: MindNode;
  selectedNodeId: string;
  onOperation: (result: OperationResult, persist?: boolean) => void;
  onSelectNode: (nodeId: string) => void;
  onFocusCanvas: () => void;
  onFocusBody: () => void;
  onStartTitleEdit: () => void;
}

export function dispatchMindmapShortcut(event: KeyboardEvent, context: MindmapShortcutDispatchContext): boolean {
  const action = getMindmapShortcutAction(event);
  if (!action) return false;

  event.preventDefault();

  if (action.type === "move-sibling") {
    context.onOperation(moveNodeWithinSiblings(context.root, context.selectedNodeId, action.direction));
    return true;
  }

  if (action.type === "select") {
    const update = getSelectionUpdate(
      context.selectedNodeId,
      getDirectionalNodeId(context.root, context.selectedNodeId, action.direction)
    );
    if (!update.changed) {
      context.onFocusCanvas();
      return true;
    }
    context.onSelectNode(update.selectedNodeId);
    context.onFocusCanvas();
    return true;
  }

  if (action.type === "promote") {
    context.onOperation(promoteNode(context.root, context.selectedNodeId));
    return true;
  }

  if (action.type === "add-child") {
    context.onOperation(addChildNode(context.root, context.selectedNodeId, "新节点"));
    return true;
  }

  if (action.type === "add-sibling") {
    context.onOperation(addSiblingNode(context.root, context.selectedNodeId, "新节点"));
    return true;
  }

  if (action.type === "focus-body") {
    context.onFocusBody();
    return true;
  }

  if (action.type === "edit-title") {
    context.onStartTitleEdit();
    return true;
  }

  if (action.type === "toggle-fold") {
    context.onOperation(toggleNodeFold(context.root, context.selectedNodeId), false);
    return true;
  }

  if (action.type === "delete") {
    context.onOperation(deleteNode(context.root, context.selectedNodeId));
    return true;
  }

  return true;
}
