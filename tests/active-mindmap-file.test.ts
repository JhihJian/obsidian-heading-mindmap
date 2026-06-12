import { describe, expect, it } from "vitest";
import { chooseMindmapSourcePath } from "../src/active-mindmap-file";

describe("choose mindmap source path", () => {
  it("当前导图视图有关联文件时优先使用导图文件", () => {
    expect(
      chooseMindmapSourcePath(
        "maps/current.md",
        { path: "notes/active.md", extension: "md" },
        "Mindmaps/未命名思维导图.md"
      )
    ).toBe("maps/current.md");
  });

  it("没有当前导图文件时使用 active Markdown 文件", () => {
    expect(
      chooseMindmapSourcePath(
        undefined,
        { path: "notes/active.md", extension: "md" },
        "Mindmaps/未命名思维导图.md"
      )
    ).toBe("notes/active.md");
  });

  it("没有可用 Markdown 上下文时使用默认导图文件", () => {
    expect(
      chooseMindmapSourcePath(
        undefined,
        { path: "assets/image.png", extension: "png" },
        "Mindmaps/未命名思维导图.md"
      )
    ).toBe("Mindmaps/未命名思维导图.md");
  });
});
