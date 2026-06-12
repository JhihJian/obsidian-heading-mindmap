import { describe, expect, it } from "vitest";
import { resolveFileNodePath } from "../src/file-node-target";

describe("file node target", () => {
  it("Obsidian 解析到真实目标文件时优先使用真实路径", () => {
    expect(resolveFileNodePath("Project.md", "notes/Project.md")).toBe("notes/Project.md");
  });

  it("没有解析结果时保留节点中保存的路径用于错误提示", () => {
    expect(resolveFileNodePath("Missing.md", undefined)).toBe("Missing.md");
  });
});
