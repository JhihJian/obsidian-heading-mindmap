import { MarkdownRenderer, Notice, type App, type Component } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { createBodyEditor } from "./body-editor";
import {
  BODY_EDITOR_HOST_CLASSES,
  BODY_PREVIEW_CONTENT_CLASSES,
  BODY_READING_VIEW_CLASSES,
  BODY_SOURCE_VIEW_CLASSES
} from "./body-pane-classes";
import {
  getClipboardImageAttachments,
  toImageEmbedLink,
  type ClipboardImageAttachment
} from "./clipboard-image-attachments";
import { getBodyPreviewSourcePath } from "./body-preview-source";
import type { MindNode } from "./mindmap-model";

export interface BodyPaneRuntimeOptions {
  app: App;
  component: Component;
  getCurrentFilePath: () => string;
  onSaveAfterEditing: () => void;
  onBodyChanged: (node: MindNode, body: string) => void;
}

export class BodyPaneRuntime {
  private readonly app: App;
  private readonly component: Component;
  private readonly getCurrentFilePath: () => string;
  private readonly onSaveAfterEditing: () => void;
  private readonly onBodyChanged: (node: MindNode, body: string) => void;
  private editorView?: EditorView;
  private previewEl?: HTMLElement;
  private previewRenderVersion = 0;

  constructor(options: BodyPaneRuntimeOptions) {
    this.app = options.app;
    this.component = options.component;
    this.getCurrentFilePath = options.getCurrentFilePath;
    this.onSaveAfterEditing = options.onSaveAfterEditing;
    this.onBodyChanged = options.onBodyChanged;
  }

  hasEditor(): boolean {
    return Boolean(this.editorView);
  }

  destroyEditor(): void {
    this.editorView?.destroy();
    this.editorView = undefined;
  }

  clearPreview(): void {
    this.previewEl = undefined;
  }

  renderPreview(container: HTMLElement, node: MindNode): void {
    this.destroyEditor();
    const readingView = container.createDiv({
      cls: BODY_READING_VIEW_CLASSES
    });
    const preview = readingView.createDiv({
      cls: BODY_PREVIEW_CONTENT_CLASSES
    });
    this.previewEl = preview;
    void this.renderMarkdownPreview(node);
  }

  renderSource(container: HTMLElement, node: MindNode): void {
    this.clearPreview();
    this.destroyEditor();

    const sourceWrap = container.createDiv({
      cls: BODY_SOURCE_VIEW_CLASSES
    });
    const editorHost = sourceWrap.createDiv({
      cls: BODY_EDITOR_HOST_CLASSES
    });

    this.editorView = createBodyEditor({
      parent: editorHost,
      doc: node.body,
      onSaveShortcut: () => {
        this.onSaveAfterEditing();
      },
      onPaste: (event, view) => this.handlePaste(event, view),
      onDocChanged: (body) => {
        this.onBodyChanged(node, body);
      },
      onBlur: () => {
        this.onSaveAfterEditing();
      }
    });
  }

  focusEditorView(): void {
    const editor = this.editorView;
    if (!editor) return;
    editor.focus();
    if (!editor.hasFocus) {
      editor.contentDOM.focus({ preventScroll: true });
    }
    editor.dom.querySelector<HTMLElement>(".cm-content")?.focus({ preventScroll: true });
  }

  scheduleEditorFocus(): void {
    const focusUntilReady = (attempt: number) => {
      const editor = this.editorView;
      if (!editor) return;
      this.focusEditorView();
      if (editor.hasFocus || editor.dom.classList.contains("cm-focused") || attempt >= 20) return;
      window.requestAnimationFrame(() => {
        window.setTimeout(() => focusUntilReady(attempt + 1), 50);
      });
    };
    window.requestAnimationFrame(() => focusUntilReady(0));
  }

  private handlePaste(event: ClipboardEvent, editorView: EditorView): boolean {
    const attachments = getClipboardImageAttachments(event.clipboardData);
    if (attachments.length === 0) return false;

    event.preventDefault();
    event.stopPropagation();
    void this.insertClipboardImages(editorView, attachments);
    return true;
  }

  private async insertClipboardImages(editorView: EditorView, attachments: ClipboardImageAttachment[]): Promise<void> {
    const sourcePath = this.getCurrentFilePath();
    const links: string[] = [];

    try {
      for (const attachment of attachments) {
        const attachmentPath = await this.app.fileManager.getAvailablePathForAttachment(
          attachment.filename,
          sourcePath
        );
        const file = await this.app.vault.createBinary(attachmentPath, await attachment.file.arrayBuffer());
        links.push(toImageEmbedLink(this.app.fileManager.generateMarkdownLink(file, sourcePath)));
      }
    } catch {
      new Notice("粘贴图片失败，请检查附件目录是否可写。");
    }

    if (links.length === 0) return;
    editorView.dispatch(editorView.state.replaceSelection(links.join("\n")));
    editorView.focus();
  }

  private async renderMarkdownPreview(node: MindNode): Promise<void> {
    const preview = this.previewEl;
    if (!preview) return;

    const version = ++this.previewRenderVersion;
    const renderTarget = preview.createDiv();
    const markdown = node.body;
    const sourcePath = getBodyPreviewSourcePath(node, this.getCurrentFilePath());
    if (!markdown.trim()) {
      preview.empty();
      preview.createDiv({ text: "当前节点没有正文。", cls: "heading-mindmap-body-empty" });
      return;
    }

    await MarkdownRenderer.render(this.app, markdown, renderTarget, sourcePath, this.component);
    if (version !== this.previewRenderVersion) return;
    preview.empty();
    preview.appendChild(renderTarget);
  }
}
