import type { MindmapDirection } from "./mindmap-navigation";

export type MindmapShortcutAction =
  | { type: "move-sibling"; direction: "up" | "down" }
  | { type: "select"; direction: MindmapDirection }
  | { type: "add-child" }
  | { type: "add-sibling" }
  | { type: "promote" }
  | { type: "focus-body" }
  | { type: "edit-title" }
  | { type: "toggle-fold" }
  | { type: "delete" };

export interface ShortcutKeyLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface ShortcutTargetState {
  isContentEditable?: boolean;
  isEditableElement?: boolean;
  isInteractiveElement?: boolean;
  insideSourceEditor?: boolean;
}

export interface DocumentShortcutTargetState {
  targetInsideView: boolean;
  targetInsideModal: boolean;
  activeViewIsMindmap: boolean;
  activeElementIsPageRoot: boolean;
}

export function getMindmapShortcutAction(event: ShortcutKeyLike): MindmapShortcutAction | null {
  if (event.altKey && event.key === "ArrowUp") return { type: "move-sibling", direction: "up" };
  if (event.altKey && event.key === "ArrowDown") return { type: "move-sibling", direction: "down" };

  const direction = getKeyDirection(event.key);
  if (direction) return { type: "select", direction };

  if (event.key === "Tab" && event.shiftKey) return { type: "promote" };
  if (event.key === "Tab") return { type: "add-child" };
  if (event.key === "Enter" && event.shiftKey) return { type: "add-sibling" };
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) return { type: "focus-body" };
  if (event.key === "Enter") return { type: "edit-title" };
  if (event.key === " ") return { type: "toggle-fold" };
  if (event.key === "Delete") return { type: "delete" };

  return null;
}

export function shouldIgnoreMindmapShortcutTarget(target: ShortcutTargetState): boolean {
  return Boolean(
    target.isContentEditable ||
      target.isEditableElement ||
      target.isInteractiveElement ||
      target.insideSourceEditor
  );
}

export function shouldHandleDocumentShortcutTarget(target: DocumentShortcutTargetState): boolean {
  if (target.targetInsideModal) return false;
  if (!target.activeViewIsMindmap) return false;
  if (target.targetInsideView) return true;
  return target.activeElementIsPageRoot;
}

function getKeyDirection(key: string): MindmapDirection | null {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  return null;
}
