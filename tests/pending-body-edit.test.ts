import { describe, expect, it } from "vitest";
import { parseMindmapMarkdown } from "../src/mindmap-model";
import { getNodeKey } from "../src/mindmap-view-state";
import { applyPendingBodyEdit, applyPendingBodyEdits } from "../src/pending-body-edit";

describe("pending body edit", () => {
  it("外部刷新重新解析后，把尚未落盘的正文编辑应用回同一结构节点", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "旧正文", "", "## 风险"].join("\n")
    );
    const target = root.children[0];
    const nodeKey = getNodeKey(root, target.id);
    if (!nodeKey) throw new Error("目标节点没有稳定 key");

    const reloaded = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "外部修改前正文", "", "## 风险", "", "外部新增正文"].join("\n")
    );

    expect(applyPendingBodyEdit(reloaded, { nodeKey, body: "导图未落盘正文" })).toBe(true);
    expect(reloaded.children[0].body).toBe("导图未落盘正文");
    expect(reloaded.children[1].body).toBe("外部新增正文");
  });

  it("找不到结构节点时保持新解析结果不变", () => {
    const reloaded = parseMindmapMarkdown("projects/map.md", "# 产品");

    expect(applyPendingBodyEdit(reloaded, { nodeKey: "missing", body: "未落盘正文" })).toBe(false);
    expect(reloaded.body).toBe("");
  });

  it("外部刷新时保留多个节点尚未落盘的正文编辑", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "旧目标正文", "", "## 风险", "", "旧风险正文"].join("\n")
    );
    const targetKey = getNodeKey(root, root.children[0].id);
    const riskKey = getNodeKey(root, root.children[1].id);
    if (!targetKey || !riskKey) throw new Error("目标节点没有稳定 key");

    const reloaded = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "外部目标正文", "", "## 风险", "", "外部风险正文"].join("\n")
    );

    expect(
      applyPendingBodyEdits(reloaded, [
        { nodeKey: targetKey, body: "导图目标正文" },
        { nodeKey: riskKey, body: "导图风险正文" }
      ])
    ).toBe(2);
    expect(reloaded.children[0].body).toBe("导图目标正文");
    expect(reloaded.children[1].body).toBe("导图风险正文");
  });
});
