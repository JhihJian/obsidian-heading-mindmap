import type { MindNode } from "./mindmap-model";

export type MindmapViewportState = {
  scale: number;
  scrollLeft: number;
  scrollTop: number;
};

export type BodyPaneSizeState = {
  heightRatio: number;
};

export type StoredMindmapState = {
  collapsedNodeKeys: string[];
  expandedFileNodeKeys: string[];
  viewport?: MindmapViewportState;
  bodyPane?: BodyPaneSizeState;
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const DEFAULT_BODY_PANE_HEIGHT_RATIO = 0.55;
const MIN_BODY_PANE_HEIGHT_RATIO = 0.25;
const MAX_BODY_PANE_HEIGHT_RATIO = 0.8;

export function normalizeViewportState(value: Partial<MindmapViewportState> | undefined): MindmapViewportState {
  return {
    scale: clampFinite(value?.scale ?? 1, MIN_SCALE, MAX_SCALE),
    scrollLeft: Math.max(0, finiteOrZero(value?.scrollLeft)),
    scrollTop: Math.max(0, finiteOrZero(value?.scrollTop))
  };
}

export function normalizeBodyPaneSize(value: Partial<BodyPaneSizeState> | undefined): BodyPaneSizeState {
  return {
    heightRatio: clampFinite(
      value?.heightRatio ?? DEFAULT_BODY_PANE_HEIGHT_RATIO,
      MIN_BODY_PANE_HEIGHT_RATIO,
      MAX_BODY_PANE_HEIGHT_RATIO
    )
  };
}

export function collectStoredMindmapState(
  root: MindNode,
  viewport?: Partial<MindmapViewportState>,
  bodyPane?: Partial<BodyPaneSizeState>
): StoredMindmapState {
  const collapsedNodeKeys: string[] = [];
  const expandedFileNodeKeys: string[] = [];

  walkNodeKeys(root, "", 0, [root], (node, key) => {
    if (node.childrenCollapsed) {
      collapsedNodeKeys.push(key);
    }
    if (node.outlineExpanded) {
      expandedFileNodeKeys.push(key);
    }
  });

  return {
    collapsedNodeKeys,
    expandedFileNodeKeys,
    viewport: viewport ? normalizeViewportState(viewport) : undefined,
    bodyPane: bodyPane ? normalizeBodyPaneSize(bodyPane) : undefined
  };
}

export function getStoredViewportState(state: StoredMindmapState | undefined): MindmapViewportState | undefined {
  if (!state?.viewport) return undefined;
  return normalizeViewportState(state.viewport);
}

export function getStoredBodyPaneSize(state: StoredMindmapState | undefined): BodyPaneSizeState | undefined {
  if (!state?.bodyPane) return undefined;
  return normalizeBodyPaneSize(state.bodyPane);
}

export function resolveInitialViewportState(
  leafViewport: Partial<MindmapViewportState> | undefined,
  storedState: StoredMindmapState | undefined
): MindmapViewportState {
  return normalizeViewportState(hasViewportValue(leafViewport) ? leafViewport : getStoredViewportState(storedState));
}

export function resolveInitialBodyPaneSize(
  leafBodyPane: Partial<BodyPaneSizeState> | undefined,
  storedState: StoredMindmapState | undefined
): BodyPaneSizeState {
  return normalizeBodyPaneSize(
    hasBodyPaneSizeValue(leafBodyPane) ? leafBodyPane : getStoredBodyPaneSize(storedState)
  );
}

export function applyStoredMindmapState(root: MindNode, state: StoredMindmapState | undefined): void {
  const collapsed = new Set(state?.collapsedNodeKeys ?? []);
  const expandedFiles = new Set(state?.expandedFileNodeKeys ?? []);

  walkNodeKeys(root, "", 0, [root], (node, key) => {
    node.childrenCollapsed = collapsed.has(key);
    if (node.type === "file") {
      node.outlineExpanded = expandedFiles.has(key);
    }
  });
}

export function getNodeKey(root: MindNode, nodeId: string): string | null {
  let found: string | null = null;
  walkNodeKeys(root, "", 0, [root], (node, key) => {
    if (node.id === nodeId) {
      found = key;
    }
  });
  return found;
}

export function getNodeIdByKey(root: MindNode, nodeKey: string | undefined): string | null {
  if (!nodeKey) return null;
  let found: string | null = null;
  walkNodeKeys(root, "", 0, [root], (node, key) => {
    if (key === nodeKey) {
      found = node.id;
    }
  });
  return found;
}

function walkNodeKeys(
  node: MindNode,
  parentKey: string,
  indexInSiblings: number,
  siblings: MindNode[],
  visit: (node: MindNode, key: string) => void
): void {
  const sameTitleIndex = siblings
    .slice(0, indexInSiblings + 1)
    .filter((sibling) => !sibling.virtual && sibling.title === node.title).length - 1;
  const keyPart = `${escapeKeyPart(node.title)}[${sameTitleIndex}]`;
  const key = parentKey ? `${parentKey}/${keyPart}` : keyPart;

  if (!node.virtual) {
    visit(node, key);
  }

  const realChildren = node.children.filter((child) => !child.virtual);
  for (let index = 0; index < realChildren.length; index += 1) {
    walkNodeKeys(realChildren[index], key, index, realChildren, visit);
  }
}

function escapeKeyPart(value: string): string {
  return encodeURIComponent(value.trim() || "未命名节点");
}

function hasViewportValue(value: Partial<MindmapViewportState> | undefined): boolean {
  return value?.scale !== undefined || value?.scrollLeft !== undefined || value?.scrollTop !== undefined;
}

function hasBodyPaneSizeValue(value: Partial<BodyPaneSizeState> | undefined): boolean {
  return value?.heightRatio !== undefined;
}

function clampFinite(value: number, min: number, max: number): number {
  const finite = finiteOrZero(value);
  return Math.min(max, Math.max(min, finite));
}

function finiteOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
