import type { Component, TFile } from "obsidian";
import { BodyPaneRuntime } from "./body-pane-runtime";
import { createStarterMindmap, type MindNode } from "./mindmap-model";
import type { PendingBodyEdit } from "./pending-body-edit";
import {
  getNodeKey,
  normalizeBodyPaneSize,
  normalizeViewportState,
  type BodyPaneSizeState,
  type MindmapViewportState
} from "./mindmap-view-state";
import type { BodyPaneMode } from "./body-pane-mode";
import type { MindmapViewState } from "./mindmap-view-config";
import type HeadingMindmapPlugin from "./main";

export class MindmapViewStore {
  root: MindNode = createStarterMindmap();
  currentFile: TFile | null = null;
  selectedNodeId = this.root.id;
  splitEl?: HTMLElement;
  canvasEl?: HTMLElement;
  surfaceEl?: HTMLElement;
  bodyPaneRuntime: BodyPaneRuntime;
  bodyPaneMode: BodyPaneMode = "preview";
  titleEditingNodeId: string | null = null;
  filePath?: string;
  viewport: MindmapViewportState = normalizeViewportState(undefined);
  bodyPane: BodyPaneSizeState = normalizeBodyPaneSize(undefined);
  selectedNodeKey?: string;
  pendingBodyEdits = new Map<string, PendingBodyEdit>();
  saveStateTimer: number | null = null;
  bodySaveTimer: number | null = null;
  saveQueue: Promise<void> = Promise.resolve();
  bodyPaneModeRequestId = 0;
  leafState: MindmapViewState = {};
  hasLeafState = false;

  onSaveBodyAfterEditing: () => void = () => undefined;
  onBodyChanged: (node: MindNode, body: string) => void = () => undefined;

  constructor(readonly plugin: HeadingMindmapPlugin, component: Component) {
    this.bodyPaneRuntime = new BodyPaneRuntime({
      app: plugin.app,
      component,
      getCurrentFilePath: () => this.currentFile?.path ?? "",
      onSaveAfterEditing: () => this.onSaveBodyAfterEditing(),
      onBodyChanged: (node, body) => this.onBodyChanged(node, body)
    });
  }

  setSelectedNode(nodeId: string): void {
    this.selectedNodeId = nodeId;
    this.selectedNodeKey = getNodeKey(this.root, this.selectedNodeId) ?? undefined;
  }
}
