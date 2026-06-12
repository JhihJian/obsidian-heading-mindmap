import { createFileNode, createTextNode, type MindNode } from "./mindmap-model";

export type OperationResult =
  | { ok: true; selectedNodeId: string; message?: string }
  | { ok: false; selectedNodeId?: string; message: string };

type NodeLocation = {
  node: MindNode;
  parent: MindNode | null;
  siblings: MindNode[];
  index: number;
};

const MAX_HEADING_LEVEL = 6;
const HEADING_LIMIT_MESSAGE = "标题最多支持六级，不能在第六级节点下继续新建子节点。";
export const READONLY_OUTLINE_MESSAGE = "当前节点是只读预览，请在对应 Markdown 文件或正文中编辑。";
export const FILE_NODE_TITLE_MESSAGE = "文件节点标题由目标 Markdown 文件名决定。";

export function addChildNode(root: MindNode, selectedNodeId: string, title = "新节点"): OperationResult {
  return addNodeAsChild(root, selectedNodeId, () => createTextNode(title, ""));
}

export function addFileChildNode(root: MindNode, selectedNodeId: string, filePath: string): OperationResult {
  return addNodeAsChild(root, selectedNodeId, () => createFileNode(filePath));
}

function addNodeAsChild(
  root: MindNode,
  selectedNodeId: string,
  createNode: () => MindNode
): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "找不到当前选中的节点。" };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }

  const childLevel = getNodeLevel(location.node) + 1;
  if (childLevel > MAX_HEADING_LEVEL) {
    return { ok: false, selectedNodeId, message: HEADING_LIMIT_MESSAGE };
  }

  const child = createNode();
  child.headingLevel = childLevel;
  location.node.children.push(child);
  location.node.childrenCollapsed = false;
  return { ok: true, selectedNodeId: child.id };
}

export function addSiblingNode(root: MindNode, selectedNodeId: string, title = "新节点"): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "找不到当前选中的节点。" };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }
  if (!location.parent) return { ok: false, selectedNodeId, message: "根节点不能新建同级节点。" };

  const sibling = createTextNode(title, "");
  sibling.headingLevel = getNodeLevel(location.node);
  location.siblings.splice(location.index + 1, 0, sibling);
  return { ok: true, selectedNodeId: sibling.id };
}

export function deleteNode(root: MindNode, selectedNodeId: string): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "找不到当前选中的节点。" };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }
  if (!location.parent) return { ok: false, selectedNodeId, message: "根节点不能删除。" };

  const previous = findAdjacentRealSibling(location.siblings, location.index, "previous");
  const next = findAdjacentRealSibling(location.siblings, location.index, "next");
  location.siblings.splice(location.index, 1);

  return {
    ok: true,
    selectedNodeId: next?.id ?? previous?.id ?? location.parent.id
  };
}

export function moveNodeWithinSiblings(
  root: MindNode,
  selectedNodeId: string,
  direction: "up" | "down"
): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "找不到当前选中的节点。" };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }
  if (!location.parent) return { ok: false, selectedNodeId, message: "根节点不能排序。" };

  const targetIndex = findAdjacentRealSiblingIndex(location.siblings, location.index, direction);
  if (targetIndex === -1) {
    return { ok: false, selectedNodeId, message: "当前节点已经在同级节点边界。" };
  }

  const [node] = location.siblings.splice(location.index, 1);
  location.siblings.splice(targetIndex, 0, node);
  return { ok: true, selectedNodeId };
}

export function promoteNode(root: MindNode, selectedNodeId: string): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "找不到当前选中的节点。" };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }
  if (!location.parent) return { ok: false, selectedNodeId, message: "根节点不能升级。" };

  const parentLocation = findLocation(root, location.parent.id);
  if (!parentLocation?.parent) {
    return { ok: false, selectedNodeId, message: "一级节点不能继续升级。" };
  }

  const [node] = location.siblings.splice(location.index, 1);
  decrementSubtreeLevel(node);
  parentLocation.siblings.splice(parentLocation.index + 1, 0, node);
  return { ok: true, selectedNodeId };
}

export function toggleNodeFold(root: MindNode, selectedNodeId: string): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "找不到当前选中的节点。" };

  if (location.node.children.length > 0) {
    location.node.childrenCollapsed = !location.node.childrenCollapsed;
    return { ok: true, selectedNodeId };
  }

  return { ok: false, selectedNodeId, message: "当前节点没有可折叠的子树。" };
}

export function canEditNodeTitle(
  root: MindNode,
  selectedNodeId: string
): { ok: true } | { ok: false; message: string } {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "找不到当前选中的节点。" };
  if (isReadonlyOutlineNode(root, selectedNodeId)) return { ok: false, message: READONLY_OUTLINE_MESSAGE };
  if (location.node.type === "file") return { ok: false, message: FILE_NODE_TITLE_MESSAGE };
  return { ok: true };
}

function findLocation(root: MindNode, id: string): NodeLocation | null {
  if (root.id === id) {
    return { node: root, parent: null, siblings: [root], index: 0 };
  }

  const stack: Array<{ parent: MindNode; children: MindNode[] }> = [
    { parent: root, children: root.children }
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (let index = 0; index < current.children.length; index += 1) {
      const node = current.children[index];
      if (node.id === id) {
        return { node, parent: current.parent, siblings: current.children, index };
      }
      stack.push({ parent: node, children: node.children });
    }
  }

  return null;
}

function getNodeLevel(node: MindNode): number {
  return node.headingLevel ?? 1;
}

function decrementSubtreeLevel(node: MindNode): void {
  node.headingLevel = Math.max(1, getNodeLevel(node) - 1);
  for (const child of node.children) {
    decrementSubtreeLevel(child);
  }
}

function findAdjacentRealSibling(
  siblings: MindNode[],
  index: number,
  direction: "previous" | "next"
): MindNode | undefined {
  const step = direction === "previous" ? -1 : 1;
  for (let current = index + step; current >= 0 && current < siblings.length; current += step) {
    if (!siblings[current].virtual) {
      return siblings[current];
    }
  }
  return undefined;
}

function findAdjacentRealSiblingIndex(
  siblings: MindNode[],
  index: number,
  direction: "up" | "down"
): number {
  const step = direction === "up" ? -1 : 1;
  for (let current = index + step; current >= 0 && current < siblings.length; current += step) {
    if (!siblings[current].virtual) {
      return current;
    }
  }
  return -1;
}

function isInsideExpandedFileOutline(root: MindNode, id: string): boolean {
  function visit(node: MindNode, insideReadonlyOutline: boolean): boolean {
    const childReadonly = insideReadonlyOutline || (node.type === "file" && Boolean(node.outlineExpanded));
    for (const child of node.children) {
      if (child.id === id) {
        return childReadonly;
      }
      if (visit(child, childReadonly)) {
        return true;
      }
    }
    return false;
  }

  return visit(root, false);
}

export function isReadonlyOutlineNode(root: MindNode, id: string): boolean {
  const node = findLocation(root, id)?.node;
  return Boolean(node?.virtual) || isInsideExpandedFileOutline(root, id);
}
