import { describe, expect, it } from "vitest";
import {
  BODY_EDITOR_HOST_CLASSES,
  BODY_PREVIEW_CONTENT_CLASSES,
  BODY_READING_VIEW_CLASSES,
  BODY_SOURCE_VIEW_CLASSES
} from "../src/body-pane-classes";

describe("body pane Obsidian classes", () => {
  it("阅读视图使用 Obsidian Markdown 阅读容器和渲染容器", () => {
    expect(BODY_READING_VIEW_CLASSES).toContain("markdown-reading-view");
    expect(BODY_READING_VIEW_CLASSES).toContain("is-readable-line-width");
    expect(BODY_READING_VIEW_CLASSES).not.toContain("markdown-rendered");
    expect(BODY_PREVIEW_CONTENT_CLASSES).toContain("markdown-preview-view");
    expect(BODY_PREVIEW_CONTENT_CLASSES).toContain("markdown-rendered");
    expect(BODY_PREVIEW_CONTENT_CLASSES).not.toContain("heading-mindmap-body-preview-content");
  });

  it("编辑视图使用 Obsidian Markdown 源码编辑容器和 CodeMirror 主题类", () => {
    expect(BODY_SOURCE_VIEW_CLASSES).toContain("markdown-source-view");
    expect(BODY_SOURCE_VIEW_CLASSES).toContain("mod-cm6");
    expect(BODY_SOURCE_VIEW_CLASSES).toContain("cm-s-obsidian");
    expect(BODY_EDITOR_HOST_CLASSES).not.toContain("markdown");
  });
});
