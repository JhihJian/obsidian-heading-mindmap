import { describe, expect, it } from "vitest";
import { parseMindmapMarkdown } from "../src/mindmap-model";
import {
  applyStoredMindmapState,
  collectStoredMindmapState,
  getStoredViewportState,
  getNodeKey,
  getNodeIdByKey,
  normalizeViewportState,
  resolveInitialViewportState
} from "../src/mindmap-view-state";

describe("mindmap view state", () => {
  it("按节点结构路径保存并恢复子树折叠状态", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "### 子目标", "", "## 风险"].join("\n")
    );
    root.children[0].childrenCollapsed = true;

    const stored = collectStoredMindmapState(root);
    const reopened = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "### 子目标", "", "## 风险"].join("\n")
    );

    applyStoredMindmapState(reopened, stored);

    expect(reopened.children[0].childrenCollapsed).toBe(true);
    expect(reopened.children[1].childrenCollapsed).toBe(false);
  });

  it("按节点结构路径保存并恢复文件节点展开状态", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## [[notes/project.md|project]]"].join("\n")
    );
    root.children[0].outlineExpanded = true;

    const stored = collectStoredMindmapState(root);
    const reopened = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## [[notes/project.md|project]]"].join("\n")
    );

    applyStoredMindmapState(reopened, stored);

    expect(reopened.children[0].outlineExpanded).toBe(true);
  });

  it("保存并规范化文件级默认视野状态，用于关闭导图后重新打开恢复", () => {
    const root = parseMindmapMarkdown("projects/map.md", "# 产品");
    const stored = collectStoredMindmapState(root, {
      scale: 3,
      scrollLeft: 120,
      scrollTop: 340
    });

    expect(getStoredViewportState(stored)).toEqual({
      scale: 2,
      scrollLeft: 120,
      scrollTop: 340
    });
  });

  it("保存真实标题状态时忽略列表项虚拟节点，避免开关列表项后状态错位", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "- 目标", "", "## 目标", "", "### 子目标"].join("\n"),
      { expandListItems: true }
    );
    const heading = root.children.find((node) => node.type === "heading" && node.title === "目标");
    if (!heading) throw new Error("找不到真实标题节点");
    heading.childrenCollapsed = true;

    const stored = collectStoredMindmapState(root);
    const reopened = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "- 目标", "", "## 目标", "", "### 子目标"].join("\n")
    );

    applyStoredMindmapState(reopened, stored);

    expect(reopened.children[0]).toMatchObject({ type: "heading", title: "目标", childrenCollapsed: true });
  });

  it("规范化视野状态，限制缩放边界并过滤非法滚动值", () => {
    expect(normalizeViewportState({ scale: 0.1, scrollLeft: -1, scrollTop: Number.NaN })).toEqual({
      scale: 0.5,
      scrollLeft: 0,
      scrollTop: 0
    });
    expect(normalizeViewportState({ scale: 3, scrollLeft: 12, scrollTop: 24 })).toEqual({
      scale: 2,
      scrollLeft: 12,
      scrollTop: 24
    });
  });

  it("初始化视野时优先使用 leaf 自身状态，否则使用文件级默认视野", () => {
    const stored = {
      collapsedNodeKeys: [],
      expandedFileNodeKeys: [],
      viewport: { scale: 1.4, scrollLeft: 120, scrollTop: 340 }
    };

    expect(resolveInitialViewportState(undefined, stored)).toEqual({
      scale: 1.4,
      scrollLeft: 120,
      scrollTop: 340
    });
    expect(resolveInitialViewportState({ scale: 0.8, scrollLeft: 10, scrollTop: 20 }, stored)).toEqual({
      scale: 0.8,
      scrollLeft: 10,
      scrollTop: 20
    });
  });

  it("新打开 leaf 的空视野状态不覆盖文件级默认视野", () => {
    const stored = {
      collapsedNodeKeys: [],
      expandedFileNodeKeys: [],
      viewport: { scale: 1.2, scrollLeft: 120, scrollTop: 40 }
    };

    expect(resolveInitialViewportState({}, stored)).toEqual({
      scale: 1.2,
      scrollLeft: 120,
      scrollTop: 40
    });
  });

  it("初始化视野时没有任何状态则回到默认视野", () => {
    expect(resolveInitialViewportState(undefined, undefined)).toEqual({
      scale: 1,
      scrollLeft: 0,
      scrollTop: 0
    });
  });

  it("用稳定结构键在重新解析后定位选中节点", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "## 目标", "", "### 子目标"].join("\n")
    );
    const selected = root.children[1].children[0];

    const key = getNodeKey(root, selected.id);
    expect(key).not.toBeNull();
    const reopened = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "## 目标", "", "### 子目标"].join("\n")
    );

    expect(getNodeIdByKey(reopened, key ?? undefined)).toBe(reopened.children[1].children[0].id);
  });

  it("同一文件的不同 leaf 可分别恢复各自选中节点和视野状态", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "## 风险"].join("\n")
    );
    const targetKey = getNodeKey(root, root.children[0].id);
    const riskKey = getNodeKey(root, root.children[1].id);
    const reopened = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "## 风险"].join("\n")
    );
    const stored = {
      collapsedNodeKeys: [],
      expandedFileNodeKeys: [],
      viewport: { scale: 1.5, scrollLeft: 400, scrollTop: 500 }
    };

    expect(getNodeIdByKey(reopened, targetKey ?? undefined)).toBe(reopened.children[0].id);
    expect(getNodeIdByKey(reopened, riskKey ?? undefined)).toBe(reopened.children[1].id);
    expect(resolveInitialViewportState({ scale: 0.8, scrollLeft: 10, scrollTop: 20 }, stored)).toEqual({
      scale: 0.8,
      scrollLeft: 10,
      scrollTop: 20
    });
    expect(resolveInitialViewportState({ scale: 1.2, scrollLeft: 120, scrollTop: 40 }, stored)).toEqual({
      scale: 1.2,
      scrollLeft: 120,
      scrollTop: 40
    });
  });

  it("虚拟列表项不生成可持久化选中键", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "- 目标"].join("\n"),
      { expandListItems: true }
    );

    expect(getNodeKey(root, root.children[0].id)).toBeNull();
  });
});
