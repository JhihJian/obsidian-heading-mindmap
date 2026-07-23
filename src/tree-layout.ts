import type { MindNode } from "./mindmap-model";

export type LayoutNode = {
  id: string;
  node: MindNode;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutEdge = {
  from: string;
  to: string;
};

export type MindmapLayout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
};

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 58;
const HORIZONTAL_GAP = 120;
const VERTICAL_GAP = 40;
const PADDING = 48;
export const MAX_NODE_WIDTH = 420;
const NODE_HORIZONTAL_PADDING = 20;
export const NODE_VERTICAL_PADDING = 20;
const NODE_BADGE_GAP = 8;
const TITLE_LINE_HEIGHT = 20;
const MIN_TITLE_WIDTH = 80;

export type NodeSize = {
  width: number;
  height: number;
};

export type NodeSizeResolver = (node: MindNode) => NodeSize;

type SubtreeLayout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  rootCenterY: number;
};

export function layoutMindmap(root: MindNode, resolveNodeSize: NodeSizeResolver = getEstimatedNodeSize): MindmapLayout {
  const subtree = layoutSubtree(root, resolveNodeSize);
  const nodes = subtree.nodes.map((node) => ({
    ...node,
    x: node.x + PADDING,
    y: node.y + PADDING
  }));

  return {
    nodes,
    edges: subtree.edges,
    width: subtree.width + PADDING * 2,
    height: subtree.height + PADDING * 2
  };
}

function layoutSubtree(node: MindNode, resolveNodeSize: NodeSizeResolver): SubtreeLayout {
  const size = resolveNodeSize(node);
  const visibleChildren = node.childrenCollapsed ? [] : node.children;
  const rootNode: LayoutNode = {
    id: node.id,
    node,
    x: 0,
    y: 0,
    width: size.width,
    height: size.height
  };

  if (visibleChildren.length === 0) {
    return {
      nodes: [rootNode],
      edges: [],
      width: size.width,
      height: size.height,
      rootCenterY: size.height / 2
    };
  }

  const childX = size.width + HORIZONTAL_GAP;
  const childNodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const childRootCenters: number[] = [];
  let nextChildY = 0;
  let maxRight = size.width;

  for (const child of visibleChildren) {
    const childLayout = layoutSubtree(child, resolveNodeSize);
    childRootCenters.push(nextChildY + childLayout.rootCenterY);
    childNodes.push(
      ...childLayout.nodes.map((layoutNode) => ({
        ...layoutNode,
        x: layoutNode.x + childX,
        y: layoutNode.y + nextChildY
      }))
    );
    edges.push({ from: node.id, to: child.id }, ...childLayout.edges);
    maxRight = Math.max(maxRight, childX + childLayout.width);
    nextChildY += childLayout.height + VERTICAL_GAP;
  }

  const childrenHeight = nextChildY - VERTICAL_GAP;
  const firstChildCenter = childRootCenters[0];
  const lastChildCenter = childRootCenters[childRootCenters.length - 1];
  let rootY = (firstChildCenter + lastChildCenter) / 2 - size.height / 2;
  const shiftY = rootY < 0 ? -rootY : 0;

  if (shiftY > 0) {
    for (const childNode of childNodes) {
      childNode.y += shiftY;
    }
    rootY = 0;
  }

  rootNode.y = rootY;
  const height = Math.max(rootY + size.height, childrenHeight + shiftY);

  return {
    nodes: [...childNodes, rootNode],
    edges,
    width: maxRight,
    height,
    rootCenterY: rootY + size.height / 2
  };
}

export function getEstimatedNodeSize(node: MindNode): NodeSize {
  const titleWidth = estimateTitleWidth(node.title);
  const badgeWidth = getBadgeWidth(node);
  const chromeWidth = NODE_HORIZONTAL_PADDING + NODE_BADGE_GAP + badgeWidth;
  const width = clamp(titleWidth + chromeWidth, NODE_WIDTH, MAX_NODE_WIDTH);
  const titleLineWidth = Math.max(MIN_TITLE_WIDTH, width - chromeWidth);
  const lineCount = Math.max(1, Math.ceil(titleWidth / titleLineWidth));
  const height = Math.max(NODE_HEIGHT, NODE_VERTICAL_PADDING + lineCount * TITLE_LINE_HEIGHT);

  return {
    width: Math.ceil(width),
    height: Math.ceil(height)
  };
}

function estimateTitleWidth(title: string): number {
  const normalizedTitle = title.trim() || "未命名节点";
  let width = 0;
  for (const char of normalizedTitle) {
    width += getEstimatedCharacterWidth(char);
  }
  return Math.max(width, MIN_TITLE_WIDTH);
}

function getEstimatedCharacterWidth(char: string): number {
  if (char === "\t") return 24;
  if (/\s/.test(char)) return 5;
  const codePoint = char.codePointAt(0) ?? 0;
  if (codePoint >= 0x2e80) return 15;
  if (/[A-Z0-9]/.test(char)) return 9;
  return 8;
}

function getBadgeWidth(node: MindNode): number {
  if (node.type === "list-item") return 42;
  if (node.type === "text") return 40;
  return 32;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
