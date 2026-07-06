import { describe, expect, it } from "vitest";
import { buildOutlineTreeFromMarkdown, parseMindmapMarkdown, serializeMindmapMarkdown } from "../src/mindmap-model";
import {
  addChildNode,
  addFileChildNode,
  addSiblingNode,
  deleteNode,
  canEditNodeTitle,
  moveNodeWithinSiblings,
  promoteNode,
  READONLY_OUTLINE_MESSAGE,
  toggleNodeFold
} from "../src/mindmap-operations";

function findByTitle(root: ReturnType<typeof parseMindmapMarkdown>, title: string) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) continue;
    if (node.title === title) return node;
    stack.unshift(...node.children);
  }
  throw new Error(`找不到节点：${title}`);
}

describe("mindmap node operations", () => {
  it("在选中节点下新建子节点，并按 Markdown 层级写回", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "目标正文。"].join("\n")
    );

    const result = addChildNode(root, findByTitle(root, "目标").id, "新子节点");

    expect(result).toMatchObject({ ok: true });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# 产品",
        "",
        "## 目标",
        "",
        "目标正文。",
        "",
        "### 新子节点",
        ""
      ].join("\n")
    );
  });

  it("新增文件节点只写入 Markdown 链接标题，不写入插件说明文字", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标"].join("\n")
    );

    const result = addFileChildNode(root, findByTitle(root, "目标").id, "notes/project.md");

    expect(result).toMatchObject({ ok: true });
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# 产品", "", "## 目标", "", "### [[notes/project.md|project]]", ""].join("\n")
    );
  });

  it("第六级节点继续新建子节点时返回明确失败原因并保持 Markdown 不变", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# L1",
        "",
        "## L2",
        "",
        "### L3",
        "",
        "#### L4",
        "",
        "##### L5",
        "",
        "###### L6"
      ].join("\n")
    );
    const before = serializeMindmapMarkdown(root);

    const result = addChildNode(root, findByTitle(root, "L6").id, "超过限制");

    expect(result).toMatchObject({
      ok: false,
      message: "标题最多支持六级，不能在第六级节点下继续新建子节点。"
    });
    expect(serializeMindmapMarkdown(root)).toBe(before);
  });

  it("在选中节点后新建同级兄弟节点", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "## 风险"].join("\n")
    );

    const result = addSiblingNode(root, findByTitle(root, "目标").id, "范围");

    expect(result).toMatchObject({ ok: true });
    expect(findByTitle(root, "产品").children.map((node) => node.title)).toEqual(["目标", "范围", "风险"]);
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# 产品", "", "## 目标", "", "## 范围", "", "## 风险", ""].join("\n")
    );
  });

  it("在 H1 后新建同级 H1 节点", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "# 复盘"].join("\n")
    );

    const result = addSiblingNode(root, findByTitle(root, "产品").id, "归档");

    expect(result).toMatchObject({ ok: true });
    expect(root.children.map((node) => node.title)).toEqual(["产品", "归档", "复盘"]);
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# 产品", "", "## 目标", "", "# 归档", "", "# 复盘", ""].join("\n")
    );
  });

  it("删除节点时一并删除子树，并把选择移动到相邻节点", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## 目标", "", "### 子目标", "", "## 风险"].join("\n")
    );

    const result = deleteNode(root, findByTitle(root, "目标").id);

    expect(result).toEqual({ ok: true, selectedNodeId: findByTitle(root, "风险").id });
    expect(findByTitle(root, "产品").children.map((node) => node.title)).toEqual(["风险"]);
    expect(serializeMindmapMarkdown(root)).toBe(["# 产品", "", "## 风险", ""].join("\n"));
  });

  it("按同级顺序上下移动节点", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## A", "", "## B", "", "## C"].join("\n")
    );

    expect(moveNodeWithinSiblings(root, findByTitle(root, "B").id, "up")).toMatchObject({ ok: true });
    expect(findByTitle(root, "产品").children.map((node) => node.title)).toEqual(["B", "A", "C"]);

    expect(moveNodeWithinSiblings(root, findByTitle(root, "B").id, "down")).toMatchObject({ ok: true });
    expect(findByTitle(root, "产品").children.map((node) => node.title)).toEqual(["A", "B", "C"]);
  });

  it("升级节点时把节点移动到父节点之后，并同步降低子树标题级别", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# 产品",
        "",
        "## A",
        "",
        "### B",
        "",
        "#### C",
        "",
        "## D"
      ].join("\n")
    );

    const result = promoteNode(root, findByTitle(root, "B").id);

    expect(result).toMatchObject({ ok: true });
    expect(findByTitle(root, "产品").children.map((node) => node.title)).toEqual(["A", "B", "D"]);
    expect(findByTitle(root, "A").children).toEqual([]);
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# 产品",
        "",
        "## A",
        "",
        "## B",
        "",
        "### C",
        "",
        "## D",
        ""
      ].join("\n")
    );
  });

  it("空格折叠导图子树，不切换下方正文区域状态", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "根正文。", "", "## 目标"].join("\n")
    );

    expect(toggleNodeFold(root, root.id)).toEqual({ ok: true, selectedNodeId: root.id });
    expect(root.bodyCollapsed).toBe(false);
    expect(root.childrenCollapsed).toBe(true);

    const child = findByTitle(root, "目标");
    child.body = "目标正文。";
    child.children.push(parseMindmapMarkdown("tmp.md", "# 子节点"));
    expect(toggleNodeFold(root, child.id)).toEqual({ ok: true, selectedNodeId: child.id });
    expect(child.bodyCollapsed).toBe(false);
    expect(child.childrenCollapsed).toBe(true);
  });

  it("拒绝编辑展开出来的跨文件大纲节点，避免产生无法写回的变更", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## [[notes/project.md|project]]"].join("\n")
    );
    const fileNode = findByTitle(root, "project");
    fileNode.outlineExpanded = true;
    fileNode.children = buildOutlineTreeFromMarkdown("notes/project.md", "# 外部标题");

    expect(addChildNode(root, fileNode.children[0].id, "误编辑")).toMatchObject({
      ok: false,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(deleteNode(root, fileNode.children[0].id)).toMatchObject({
      ok: false,
      message: READONLY_OUTLINE_MESSAGE
    });
  });

  it("拒绝把列表项虚拟节点作为真实 Markdown 标题节点编辑", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "- 目标一", "- 目标二"].join("\n"),
      { expandListItems: true }
    );
    const listItem = findByTitle(root, "目标一");
    const before = serializeMindmapMarkdown(root);

    expect(addChildNode(root, listItem.id, "误新增")).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(addSiblingNode(root, listItem.id, "误新增")).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(deleteNode(root, listItem.id)).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(moveNodeWithinSiblings(root, listItem.id, "down")).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(promoteNode(root, listItem.id)).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(serializeMindmapMarkdown(root)).toBe(before);
  });

  it("文件节点标题由目标文件名决定，不能作为普通标题编辑", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## [[notes/project.md|project]]"].join("\n")
    );

    expect(canEditNodeTitle(root, findByTitle(root, "project").id)).toEqual({
      ok: false,
      message: "文件节点标题由目标 Markdown 文件名决定。"
    });
  });

  it("外部大纲里的文件节点标题编辑优先提示只读预览", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "## [[notes/project.md|project]]"].join("\n")
    );
    const fileNode = findByTitle(root, "project");
    fileNode.outlineExpanded = true;
    fileNode.children = buildOutlineTreeFromMarkdown(
      "notes/project.md",
      "# 外部标题\n\n## [[notes/other.md|other]]"
    );
    const nestedFileNode = fileNode.children[0].children[0];

    expect(canEditNodeTitle(root, nestedFileNode.id)).toEqual({
      ok: false,
      message: READONLY_OUTLINE_MESSAGE
    });
  });

  it("对真实标题排序和删除时忽略列表项虚拟节点", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# 产品", "", "- 列表项", "", "## A", "", "## B"].join("\n"),
      { expandListItems: true }
    );
    const listItem = findByTitle(root, "列表项");
    const headingA = findByTitle(root, "A");
    const headingB = findByTitle(root, "B");
    const product = findByTitle(root, "产品");

    expect(moveNodeWithinSiblings(root, headingA.id, "up")).toMatchObject({
      ok: false,
      selectedNodeId: headingA.id,
      message: "当前节点已经在同级节点边界。"
    });
    expect(product.children.map((node) => node.id)).toEqual([listItem.id, headingA.id, headingB.id]);

    expect(deleteNode(root, headingA.id)).toEqual({ ok: true, selectedNodeId: headingB.id });
    expect(product.children.map((node) => node.id)).toEqual([listItem.id, headingB.id]);
    expect(serializeMindmapMarkdown(root)).toBe(["# 产品", "", "- 列表项", "", "## B", ""].join("\n"));
  });
});
