import { describe, expect, it } from "vitest";
import { decideMindmapOpenPolicy } from "../src/view-open-policy";

describe("mindmap open policy", () => {
  it("当前 leaf 已是同一文件导图时复用当前导图", () => {
    expect(decideMindmapOpenPolicy({ filePath: "notes/a.md" }, "notes/a.md")).toBe("reuse-current-mindmap");
  });

  it("已有导图打开其他文件时不复用它覆盖状态", () => {
    expect(decideMindmapOpenPolicy({ filePath: "notes/a.md" }, "notes/b.md")).toBe("open-in-new-tab");
  });

  it("当前 leaf 不是导图时打开新 tab 保留源码视图", () => {
    expect(decideMindmapOpenPolicy(null, "notes/a.md")).toBe("open-in-new-tab");
  });
});
