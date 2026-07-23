import type { MindNode } from "./mindmap-model";
import { getNodeBadge } from "./mindmap-node-display";
import {
  createMindmapNodeSizeResolver,
  type MindmapNodeSizeCache
} from "./mindmap-node-measurer";
import { shouldChangeSelectedNode } from "./node-selection";
import { layoutMindmap, type LayoutNode } from "./tree-layout";
import type { MindmapViewportState } from "./mindmap-view-state";
import { getSurfacePlacement, restoreViewportScroll, type ViewportPoint } from "./viewport-dom";

export interface MindmapCanvasRenderResult {
  surfaceEl: HTMLElement;
}

export interface MindmapCanvasOptions {
  root: MindNode;
  nodeSizeCache: MindmapNodeSizeCache;
  viewport: MindmapViewportState;
  selectedNodeId: string;
  titleEditingNodeId: string | null;
  onKeydown: (event: KeyboardEvent) => void;
  onScroll: () => void;
  onFocusCanvas: () => void;
  onScaleChange: (scaleDelta: number, center?: ViewportPoint) => void;
  onSelectNode: (nodeId: string) => void;
  onToggleFileOutline: (node: MindNode) => void;
  onToggleNodeChildrenFold: (node: MindNode) => void;
  onCommitTitleEdit: (node: MindNode, value: string) => void;
  onCancelTitleEdit: () => void;
}

export function renderMindmapCanvas(canvas: HTMLElement, options: MindmapCanvasOptions): MindmapCanvasRenderResult {
  const nodeSizeMeasurer = createMindmapNodeSizeResolver(canvas, options.nodeSizeCache);
  const layout = layoutMindmap(options.root, nodeSizeMeasurer.resolve);
  nodeSizeMeasurer.destroy();
  canvas.style.setProperty("--mindmap-width", `${layout.width}px`);
  canvas.style.setProperty("--mindmap-height", `${layout.height}px`);
  canvas.tabIndex = 0;
  canvas.onkeydown = (event) => {
    event.stopPropagation();
    options.onKeydown(event);
  };
  canvas.onclick = () => {
    options.onFocusCanvas();
  };
  canvas.onscroll = () => {
    options.onScroll();
  };
  canvas.onwheel = (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    options.onScaleChange(event.deltaY > 0 ? -0.1 : 0.1, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  const scrollArea = canvas.createDiv({ cls: "heading-mindmap-scroll-area" });
  const placement = getSurfacePlacement(
    { width: layout.width, height: layout.height },
    { width: canvas.clientWidth, height: canvas.clientHeight },
    options.viewport
  );
  scrollArea.style.width = `${placement.scrollAreaWidth}px`;
  scrollArea.style.height = `${placement.scrollAreaHeight}px`;

  const surface = scrollArea.createDiv({ cls: "heading-mindmap-surface" });
  surface.style.left = `${placement.offsetLeft}px`;
  surface.style.top = `${placement.offsetTop}px`;
  surface.style.width = `${layout.width}px`;
  surface.style.height = `${layout.height}px`;
  surface.style.transform = `scale(${options.viewport.scale})`;

  renderMindmapEdges(surface, layout);
  for (const layoutNode of layout.nodes) {
    renderMindmapNode(surface, layoutNode, options);
  }

  restoreViewportScroll(canvas, options.viewport);
  return { surfaceEl: surface };
}

function renderMindmapEdges(surface: HTMLElement, layout: ReturnType<typeof layoutMindmap>): void {
  const svg = surface.createSvg("svg", {
    cls: "heading-mindmap-edges",
    attr: {
      width: String(layout.width),
      height: String(layout.height)
    }
  });

  const nodePositions = new Map(layout.nodes.map((node) => [node.id, node]));
  for (const edge of layout.edges) {
    const from = nodePositions.get(edge.from);
    const to = nodePositions.get(edge.to);
    if (!from || !to) continue;

    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;
    const midX = (startX + endX) / 2;

    svg.createSvg("path", {
      attr: {
        d: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
        class: "heading-mindmap-edge"
      }
    });
  }
}

function renderMindmapNode(surface: HTMLElement, layoutNode: LayoutNode, options: MindmapCanvasOptions): void {
  const { node, x, y, width, height } = layoutNode;
  const el = surface.createDiv({
    cls: [
      "heading-mindmap-node",
      `is-${node.type}`,
      node.id === options.selectedNodeId ? "is-selected" : ""
    ].join(" ")
  });
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.dataset.nodeId = node.id;
  el.tabIndex = 0;
  el.onclick = (event) => {
    event.stopPropagation();
    selectNodeFromCanvas(node.id, options);
  };
  el.ondblclick = () => {
    if (node.type === "file") {
      options.onToggleFileOutline(node);
      return;
    }
    options.onToggleNodeChildrenFold(node);
  };

  const header = el.createDiv({ cls: "heading-mindmap-node-header" });
  if (options.titleEditingNodeId === node.id) {
    renderTitleInput(header, node, options);
  } else {
    renderTitleLabel(header, node, options);
  }
  header.createSpan({ text: getNodeBadge(node), cls: "heading-mindmap-node-badge" });
}

function renderTitleInput(header: HTMLElement, node: MindNode, options: MindmapCanvasOptions): void {
  const input = header.createEl("textarea", {
    cls: "heading-mindmap-node-title-input"
  });
  input.value = node.title;
  input.onclick = (event) => event.stopPropagation();
  input.ondblclick = (event) => event.stopPropagation();
  input.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      options.onCommitTitleEdit(node, input.value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      options.onCancelTitleEdit();
    }
  };
  input.onblur = () => {
    options.onCommitTitleEdit(node, input.value);
  };
  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

function renderTitleLabel(header: HTMLElement, node: MindNode, options: MindmapCanvasOptions): void {
  const titleEl = header.createSpan({ text: node.title, cls: "heading-mindmap-node-title" });
  titleEl.onclick = (event) => {
    event.stopPropagation();
    selectNodeFromCanvas(node.id, options);
  };
}

function selectNodeFromCanvas(nodeId: string, options: MindmapCanvasOptions): void {
  if (!shouldChangeSelectedNode(options.selectedNodeId, nodeId)) {
    options.onFocusCanvas();
    return;
  }
  options.onSelectNode(nodeId);
  options.onFocusCanvas();
}
