import type { MindNode } from "./mindmap-model";

export type LayoutNode = {
  id: string;
  node: MindNode;
  x: number;
  y: number;
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

const NODE_WIDTH = 240;
const NODE_HEIGHT = 58;
const HORIZONTAL_GAP = 120;
const VERTICAL_GAP = 40;
const PADDING = 48;

export function layoutMindmap(root: MindNode): MindmapLayout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let nextLeafY = PADDING;

  function place(node: MindNode, depth: number): number {
    const x = PADDING + depth * (NODE_WIDTH + HORIZONTAL_GAP);
    const visibleChildren = node.childrenCollapsed ? [] : node.children;

    if (visibleChildren.length === 0) {
      const y = nextLeafY;
      nextLeafY += NODE_HEIGHT + VERTICAL_GAP;
      nodes.push({ id: node.id, node, x, y });
      return y;
    }

    const childCenters = visibleChildren.map((child) => {
      edges.push({ from: node.id, to: child.id });
      return place(child, depth + 1);
    });
    const first = childCenters[0];
    const last = childCenters[childCenters.length - 1];
    const y = (first + last) / 2;
    nodes.push({ id: node.id, node, x, y });
    return y;
  }

  place(root, 0);

  const width = Math.max(...nodes.map((node) => node.x + NODE_WIDTH + PADDING));
  const height = Math.max(...nodes.map((node) => node.y + NODE_HEIGHT + PADDING));

  return {
    nodes,
    edges,
    width,
    height
  };
}

export const layoutConstants = {
  nodeWidth: NODE_WIDTH,
  nodeHeight: NODE_HEIGHT
};
