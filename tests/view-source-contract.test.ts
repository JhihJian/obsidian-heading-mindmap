import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viewModuleFiles = [
  "src/mindmap-view.ts",
  "src/mindmap-view-actions.ts",
  "src/mindmap-view-loader.ts",
  "src/mindmap-view-persistence.ts",
  "src/mindmap-view-renderer.ts",
  "src/mindmap-view-store.ts",
  "src/mindmap-canvas-dom.ts",
  "src/mindmap-toolbar-dom.ts",
  "src/body-pane-runtime.ts",
  "src/body-pane-resizer.ts"
];

const viewSource = readFileSync("src/mindmap-view.ts", "utf8");
const bodyEditorSource = readFileSync("src/body-editor.ts", "utf8");
const bodyPaneDomSource = readFileSync("src/body-pane-dom.ts", "utf8");
const bodyPaneRuntimeSource = readFileSync("src/body-pane-runtime.ts", "utf8");
const canvasDomSource = readFileSync("src/mindmap-canvas-dom.ts", "utf8");
const actionsSource = readFileSync("src/mindmap-view-actions.ts", "utf8");
const loaderSource = readFileSync("src/mindmap-view-loader.ts", "utf8");
const rendererSource = readFileSync("src/mindmap-view-renderer.ts", "utf8");
const toolbarDomSource = readFileSync("src/mindmap-toolbar-dom.ts", "utf8");

describe("view source contract", () => {
  it("视图相关单文件保持在 300 行以内", () => {
    for (const file of viewModuleFiles) {
      const lineCount = readFileSync(file, "utf8").split(/\r?\n/).length;
      expect(lineCount, file).toBeLessThanOrEqual(300);
    }
  });

  it("导图节点只渲染标题和类型标识，不在节点内放按钮或正文", () => {
    expect(canvasDomSource).toContain("function renderMindmapNode");
    expect(canvasDomSource).not.toContain("ButtonComponent");
    expect(canvasDomSource).not.toContain('createEl("button"');
    expect(canvasDomSource).not.toContain("node.body");
    expect(canvasDomSource).toContain("node.title");
    expect(canvasDomSource).toContain("getNodeBadge");
  });

  it("正文区右上角保留阅读/编辑切换按钮，导图工具栏承载视图级操作", () => {
    expect(rendererSource).toContain("renderBodyPaneShell");
    expect(rendererSource).toContain("setBodyPaneMinimized");
    expect(bodyPaneDomSource).toContain("new ButtonComponent(actions)");
    expect(bodyPaneDomSource).toContain("toggleBodyPaneMode");
    expect(toolbarDomSource).toContain("renderToolbarButton(actions");
    expect(toolbarDomSource).toContain("heading-mindmap-zoom-controls");
    expect(rendererSource).toContain("onAddFileNode");
    expect(actionsSource).toContain("openFilePicker");
  });

  it("正文区最小化时隐藏正文内容和拖拽条，并通过正文状态恢复", () => {
    expect(rendererSource).toContain("this.store.bodyPane.minimized");
    expect(bodyPaneDomSource).toContain("is-minimized");
    expect(rendererSource).toContain("if (minimized) return");
    expect(rendererSource).toContain("if (this.store.bodyPane.minimized) return");
    expect(rendererSource).toContain("setBodyPaneMinimized(false, { focusEditor: true })");
  });

  it("正文源码编辑器接管图片粘贴并使用 Obsidian 附件链路", () => {
    expect(bodyPaneRuntimeSource).toContain("createBodyEditor");
    expect(bodyPaneRuntimeSource).toContain("handlePaste");
    expect(bodyEditorSource).toContain("EditorView.domEventHandlers");
    expect(bodyEditorSource).toContain("Mod-Enter");
    expect(bodyEditorSource).toContain("EditorView.lineWrapping");
    expect(bodyEditorSource).toContain("EditorView.updateListener");
    expect(bodyPaneRuntimeSource).toContain("getAvailablePathForAttachment");
    expect(bodyPaneRuntimeSource).toContain("createBinary");
    expect(bodyPaneRuntimeSource).toContain("generateMarkdownLink");
  });

  it("视图类只做协调，不直接承载已拆出的 DOM、编辑器和操作分发细节", () => {
    expect(viewSource).not.toContain("MarkdownRenderer");
    expect(viewSource).not.toContain("createBodyEditor");
    expect(viewSource).not.toContain("getMindmapShortcutAction");
    expect(viewSource).not.toContain("moveNodeWithinSiblings");
    expect(viewSource).not.toContain("getStableScrollAreaSize");
    expect(viewSource).toContain("MindmapViewRenderer");
    expect(viewSource).toContain("MindmapViewActions");
    expect(viewSource).toContain("MindmapViewLoader");
    expect(rendererSource).toContain("renderMindmapCanvas");
    expect(actionsSource).toContain("dispatchMindmapShortcut");
  });

  it("视图打开时区分等待 leaf state 和激活默认导图，避免空 state 重复打开视图", () => {
    expect(loaderSource).toContain("decideMindmapStateLoadPolicy");
    expect(loaderSource).toContain("policy === \"await-state\"");
    expect(loaderSource).toContain("policy === \"activate-default\"");
    expect(loaderSource).not.toContain("if (!this.filePath)");
    expect(viewSource).not.toContain("loadFromState");
  });
});
