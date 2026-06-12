import { describe, expect, it } from "vitest";
import { decideMindmapStateLoadPolicy } from "../src/view-state-load-policy";

describe("mindmap state load policy", () => {
  it("有文件路径时加载目标文件", () => {
    expect(decideMindmapStateLoadPolicy("notes/map.md", true)).toBe("load-file");
  });

  it("setState 收到空 state 时激活默认导图", () => {
    expect(decideMindmapStateLoadPolicy(undefined, true)).toBe("activate-default");
  });

  it("onOpen 尚未收到 leaf state 时等待 setState，避免重复打开视图", () => {
    expect(decideMindmapStateLoadPolicy(undefined, false)).toBe("await-state");
  });
});
