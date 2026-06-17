import type { MindmapViewportState } from "./mindmap-view-state";

export const VIEW_TYPE_MINDMAP = "heading-mindmap-view";
export const DEFAULT_MINDMAP_PATH = "Mindmaps/未命名思维导图.md";

export type MindmapViewState = {
  filePath?: string;
  selectedNodeKey?: string;
  viewport?: Partial<MindmapViewportState>;
};
