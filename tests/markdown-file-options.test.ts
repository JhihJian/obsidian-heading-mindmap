import { describe, expect, it } from "vitest";
import { getFileNodeOptions } from "../src/markdown-file-options";

describe("markdown file node options", () => {
  it("添加文件节点时排除当前导图文件，避免自引用", () => {
    const options = getFileNodeOptions(
      [
        { path: "maps/current.md" },
        { path: "notes/reference.md" }
      ],
      "maps/current.md"
    );

    expect(options.map((file) => file.path)).toEqual(["notes/reference.md"]);
  });

  it("没有当前文件路径时保留全部候选", () => {
    const options = getFileNodeOptions([{ path: "notes/a.md" }, { path: "notes/b.md" }], undefined);

    expect(options.map((file) => file.path)).toEqual(["notes/a.md", "notes/b.md"]);
  });
});
