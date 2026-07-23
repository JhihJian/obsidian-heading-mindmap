import { getNodeBadge } from "./mindmap-node-display";
import type { MindNode } from "./mindmap-model";
import {
  MAX_NODE_WIDTH,
  NODE_HEIGHT,
  NODE_VERTICAL_PADDING,
  NODE_WIDTH,
  type NodeSize,
  type NodeSizeResolver
} from "./tree-layout";

const NODE_WIDTH_SAFETY_MARGIN = 12;

export type MindmapNodeSizeCache = Map<string, NodeSize>;

export function createMindmapNodeSizeResolver(
  container: HTMLElement,
  cache: MindmapNodeSizeCache
): { resolve: NodeSizeResolver; destroy: () => void } {
  const layer = container.ownerDocument.createElement("div");
  layer.className = "heading-mindmap-node-measure-layer";
  container.appendChild(layer);

  const resolve = (node: MindNode): NodeSize => {
    const key = getCacheKey(node);
    const cached = cache.get(key);
    if (cached) return cached;

    const measured = measureNode(layer, node);
    cache.set(key, measured);
    return measured;
  };

  return {
    resolve,
    destroy: () => layer.remove()
  };
}

function measureNode(layer: HTMLElement, node: MindNode): NodeSize {
  const element = layer.ownerDocument.createElement("div");
  element.className = `heading-mindmap-node is-${node.type}`;
  element.style.height = "auto";
  element.style.left = "0";
  element.style.minWidth = "0";
  element.style.position = "relative";
  element.style.top = "0";
  element.style.width = "max-content";

  const header = layer.ownerDocument.createElement("div");
  header.className = "heading-mindmap-node-header";
  element.appendChild(header);

  const title = layer.ownerDocument.createElement("span");
  title.className = "heading-mindmap-node-title";
  title.textContent = node.title;
  title.style.whiteSpace = "nowrap";
  header.appendChild(title);

  const badge = layer.ownerDocument.createElement("span");
  badge.className = "heading-mindmap-node-badge";
  badge.textContent = getNodeBadge(node);
  header.appendChild(badge);
  layer.appendChild(element);

  const naturalWidth = element.getBoundingClientRect().width;
  const width = clamp(Math.ceil(naturalWidth + NODE_WIDTH_SAFETY_MARGIN), NODE_WIDTH, MAX_NODE_WIDTH);
  element.style.width = `${width}px`;
  title.style.whiteSpace = "normal";

  const titleHeight = title.getBoundingClientRect().height;
  const height = Math.max(NODE_HEIGHT, Math.ceil(titleHeight + NODE_VERTICAL_PADDING));
  element.remove();

  return { width, height };
}

function getCacheKey(node: MindNode): string {
  return [node.type, node.headingLevel ?? "", node.title].join("\u0000");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
