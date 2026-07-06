import { describe, expect, it } from "vitest";
import {
  buildOutlineTree,
  buildOutlineTreeFromMarkdown,
  applyListItemExpansion,
  createFileNode,
  createStarterMindmap,
  deserializeMindmap,
  parseMindmapMarkdown,
  serializeMindmap,
  serializeMindmapMarkdown
} from "../src/mindmap-model";

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

describe("buildOutlineTree", () => {
  it("把扁平 Markdown 标题缓存转换为层级导图节点", () => {
    const nodes = buildOutlineTree("notes/project.md", [
      { heading: "目标", level: 1 },
      { heading: "范围", level: 2 },
      { heading: "里程碑", level: 2 },
      { heading: "第一周", level: 3 },
      { heading: "附录", level: 1 }
    ]);

    expect(nodes).toMatchObject([
      {
        type: "heading",
        title: "目标",
        children: [
          { title: "范围", children: [] },
          { title: "里程碑", children: [{ title: "第一周", children: [] }] }
        ]
      },
      {
        type: "heading",
        title: "附录",
        children: []
      }
    ]);
  });

  it("忽略空标题，并在缺级时挂到最近可用父节点", () => {
    const nodes = buildOutlineTree("notes/project.md", [
      { heading: "根", level: 1 },
      { heading: "", level: 2 },
      { heading: "直接三级", level: 3 }
    ]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].children.map((node) => node.title)).toEqual(["直接三级"]);
  });

  it("从目标 Markdown 构建跨文件大纲时保留标题正文用于只读预览", () => {
    const nodes = buildOutlineTreeFromMarkdown(
      "notes/project.md",
      [
        "# 项目",
        "",
        "项目正文。",
        "",
        "## 目标",
        "",
        "- 目标一",
        "",
        "## 风险",
        "",
        "风险正文。"
      ].join("\n")
    );

    expect(nodes).toMatchObject([
      {
        title: "项目",
        body: "项目正文。",
        children: [
          { title: "目标", body: "- 目标一" },
          { title: "风险", body: "风险正文。" }
        ]
      }
    ]);
  });

  it("目标 Markdown 没有一级标题时，不把文件名合成根作为外部大纲节点", () => {
    const nodes = buildOutlineTreeFromMarkdown(
      "notes/project.md",
      ["文件开头说明。", "", "## 目标", "", "目标正文。"].join("\n")
    );

    expect(nodes).toMatchObject([{ title: "目标", body: "目标正文。" }]);
  });
});

describe("Mindmap serialization", () => {
  it("序列化后可以恢复文件节点和折叠状态", () => {
    const root = createStarterMindmap();
    root.children.push(createFileNode("notes/project.md"));
    root.bodyCollapsed = true;

    const restored = deserializeMindmap(serializeMindmap(root));

    expect(restored.title).toBe("我的思维导图");
    expect(restored.bodyCollapsed).toBe(true);
    expect(restored.children[1]).toMatchObject({
      type: "file",
      title: "project",
      filePath: "notes/project.md"
    });
  });
});

describe("Mindmap Markdown files", () => {
  it("把 Markdown 标题层级解析为导图节点，并只把当前标题下的正文放入节点内容", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "# 产品规划",
        "",
        "根节点正文第一段。",
        "",
        "## 目标",
        "",
        "- 支持标题和正文",
        "",
        "### 子目标",
        "",
        "子目标正文。",
        "",
        "## 风险",
        "",
        "风险正文。"
      ].join("\n")
    );

    expect(root).toMatchObject({
      type: "document",
      title: "导图",
      body: "",
      children: [
        {
          type: "heading",
          title: "产品规划",
          body: "根节点正文第一段。",
          headingLevel: 1,
          children: [
            {
              type: "heading",
              title: "目标",
              body: "- 支持标题和正文",
              headingLevel: 2,
              children: [
                {
                  title: "子目标",
                  body: "子目标正文。",
                  headingLevel: 3,
                  children: []
                }
              ]
            },
            {
              title: "风险",
              body: "风险正文。",
              headingLevel: 2,
              children: []
            }
          ]
        }
      ]
    });
  });

  it("解析标题时只移除合法 closing hashes，不丢失标题正文里的行尾 #", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      ["# C#", "", "## 标题 ###"].join("\n")
    );

    const heading = root.children[0];
    expect(heading.title).toBe("C#");
    expect(heading.children[0].title).toBe("标题");
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# C#", "", "## 标题", ""].join("\n")
    );
  });

  it("解析最多三空格缩进的 Markdown 标题，但不把四空格代码当标题", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "   # 产品规划",
        "",
        "   ## 目标",
        "",
        "    ### 代码里的伪标题"
      ].join("\n")
    );

    const heading = root.children[0];
    expect(heading.title).toBe("产品规划");
    expect(heading.children[0]).toMatchObject({
      title: "目标",
      body: "    ### 代码里的伪标题"
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# 产品规划",
        "",
        "## 目标",
        "",
        "    ### 代码里的伪标题",
        ""
      ].join("\n")
    );
  });

  it("按 fence marker 和长度识别代码块，不把长 fence 内的短 fence 示例当作结束", () => {
    const markdown = [
      "# 产品规划",
      "",
      "````",
      "```",
      "# 代码里的伪标题",
      "```",
      "````",
      "",
      "## 真实标题"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown);
    const heading = root.children[0];

    expect(heading.children.map((node) => node.title)).toEqual(["真实标题"]);
    expect(heading.body).toBe(["````", "```", "# 代码里的伪标题", "```", "````"].join("\n"));
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("fence 关闭行带非空白尾随内容时，不提前结束代码块并误解析标题", () => {
    const markdown = [
      "# 产品规划",
      "",
      "```",
      "```not-close",
      "# 代码里的伪标题",
      "```",
      "",
      "## 真实标题"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown);
    const heading = root.children[0];

    expect(heading.children.map((node) => node.title)).toEqual(["真实标题"]);
    expect(heading.body).toBe(["```", "```not-close", "# 代码里的伪标题", "```"].join("\n"));
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("没有一级标题但有子标题时，用文件名作为文档根标题，并保持原始标题层级", () => {
    const root = parseMindmapMarkdown(
      "notes/project-map.md",
      [
        "导图开头说明。",
        "",
        "## 第一部分",
        "",
        "第一部分正文。"
      ].join("\n")
    );

    expect(root).toMatchObject({
      type: "document",
      title: "project-map",
      body: "导图开头说明。",
      children: [
        {
          title: "第一部分",
          body: "第一部分正文。",
          headingLevel: 2
        }
      ]
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "导图开头说明。",
        "",
        "## 第一部分",
        "",
        "第一部分正文。",
        ""
      ].join("\n")
    );
  });

  it("没有任何标题时，用文件名作为根节点标题，并把整篇内容作为根节点正文", () => {
    const root = parseMindmapMarkdown(
      "notes/free-note.md",
      ["自由笔记第一段。", "", "- 列表内容"].join("\n")
    );

    expect(root).toMatchObject({
      title: "free-note",
      body: "自由笔记第一段。\n\n- 列表内容",
      children: []
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      ["自由笔记第一段。", "", "- 列表内容", ""].join("\n")
    );
  });

  it("没有任何标题但有 YAML frontmatter 时，仍把 frontmatter 保留在文件顶部", () => {
    const root = parseMindmapMarkdown(
      "notes/free-note.md",
      ["---", "tags:", "  - project", "---", "", "自由笔记正文。"].join("\n")
    );

    expect(root).toMatchObject({
      title: "free-note",
      body: "自由笔记正文。",
      preface: ["---", "tags:", "  - project", "---"].join("\n"),
      children: []
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      ["---", "tags:", "  - project", "---", "", "自由笔记正文。", ""].join("\n")
    );
  });

  it("没有标题且 YAML frontmatter 内含空行时，仍保留完整 frontmatter", () => {
    const root = parseMindmapMarkdown(
      "notes/free-note.md",
      ["---", "title: 自由笔记", "", "tags:", "  - project", "---", "", "自由笔记正文。"].join("\n")
    );

    expect(root).toMatchObject({
      title: "free-note",
      body: "自由笔记正文。",
      preface: ["---", "title: 自由笔记", "", "tags:", "  - project", "---"].join("\n"),
      children: []
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "---",
        "title: 自由笔记",
        "",
        "tags:",
        "  - project",
        "---",
        "",
        "自由笔记正文。",
        ""
      ].join("\n")
    );
  });

  it("YAML block scalar 内缩进的 --- 和 # 不会结束 frontmatter 或解析为标题", () => {
    const root = parseMindmapMarkdown(
      "notes/free-note.md",
      [
        "---",
        "description: |",
        "  ---",
        "  # 这仍是 YAML 字符串内容",
        "tags:",
        "  - project",
        "---",
        "",
        "自由笔记正文。"
      ].join("\n")
    );

    expect(root).toMatchObject({
      title: "free-note",
      body: "自由笔记正文。",
      preface: [
        "---",
        "description: |",
        "  ---",
        "  # 这仍是 YAML 字符串内容",
        "tags:",
        "  - project",
        "---"
      ].join("\n"),
      children: []
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "---",
        "description: |",
        "  ---",
        "  # 这仍是 YAML 字符串内容",
        "tags:",
        "  - project",
        "---",
        "",
        "自由笔记正文。",
        ""
      ].join("\n")
    );
  });

  it("把导图节点序列化为普通 Markdown 标题和正文", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "# 产品规划",
        "",
        "根节点正文。",
        "",
        "## 目标",
        "",
        "- 支持标题和正文",
        "",
        "### 子目标",
        "",
        "子目标正文。"
      ].join("\n")
    );

    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# 产品规划",
        "",
        "根节点正文。",
        "",
        "## 目标",
        "",
        "- 支持标题和正文",
        "",
        "### 子目标",
        "",
        "子目标正文。",
        ""
      ].join("\n")
    );
  });

  it("用 Obsidian 链接标题持久化 Markdown 文件节点", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "# 产品规划",
        "",
        "## [[notes/project.md|project]]",
        "",
        "文件节点备注。"
      ].join("\n")
    );

    expect(findByTitle(root, "project")).toMatchObject({
      type: "file",
      title: "project",
      body: "文件节点备注。",
      filePath: "notes/project.md",
      outlineExpanded: false
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# 产品规划",
        "",
        "## [[notes/project.md|project]]",
        "",
        "文件节点备注。",
        ""
      ].join("\n")
    );
  });

  it("识别不带 .md 扩展名的 Obsidian 文件链接标题", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "# 产品规划",
        "",
        "## [[notes/project|project]]"
      ].join("\n")
    );

    expect(findByTitle(root, "project")).toMatchObject({
      type: "file",
      title: "project",
      filePath: "notes/project.md"
    });
  });

  it("识别带标题或块引用子路径的 Obsidian 文件链接标题", () => {
    const headingLinkRoot = parseMindmapMarkdown(
      "projects/导图.md",
      ["# 产品规划", "", "## [[notes/project#目标|project]]"].join("\n")
    );
    const blockLinkRoot = parseMindmapMarkdown(
      "projects/导图.md",
      ["# 产品规划", "", "## [[notes/tasks^abc123|tasks]]"].join("\n")
    );

    expect(findByTitle(headingLinkRoot, "project")).toMatchObject({
      type: "file",
      title: "project",
      filePath: "notes/project.md"
    });
    expect(findByTitle(blockLinkRoot, "tasks")).toMatchObject({
      type: "file",
      title: "tasks",
      filePath: "notes/tasks.md"
    });
    expect(serializeMindmapMarkdown(headingLinkRoot)).toBe(
      ["# 产品规划", "", "## [[notes/project.md|project]]", ""].join("\n")
    );
  });

  it("本文件内标题链接不作为 Markdown 文件节点", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      ["# 产品规划", "", "## [[#目标|目标]]"].join("\n")
    );

    expect(findByTitle(root, "[[#目标|目标]]")).toMatchObject({
      type: "heading",
      title: "[[#目标|目标]]",
      filePath: "projects/导图.md"
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# 产品规划", "", "## [[#目标|目标]]", ""].join("\n")
    );
  });

  it("文件节点始终显示目标 Markdown 文件名，而不是链接别名", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "# 产品规划",
        "",
        "## [[notes/project.md|自定义别名]]"
      ].join("\n")
    );

    expect(findByTitle(root, "project")).toMatchObject({
      type: "file",
      title: "project",
      filePath: "notes/project.md"
    });
  });

  it("文件节点写回时始终使用目标文件名作为 Obsidian 链接别名", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "# 产品规划",
        "",
        "## [[notes/project.md|project]]"
      ].join("\n")
    );
    findByTitle(root, "project").title = "误改别名";

    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# 产品规划",
        "",
        "## [[notes/project.md|project]]",
        ""
      ].join("\n")
    );
  });

  it("序列化时不把文件节点自动展开的大纲写入导图 Markdown", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "# 产品规划",
        "",
        "## [[notes/project.md|project]]"
      ].join("\n")
    );
    const fileNode = findByTitle(root, "project");
    fileNode.outlineExpanded = true;
    fileNode.children = buildOutlineTree("notes/project.md", [
      { heading: "外部文件标题", level: 1 },
      { heading: "外部文件子标题", level: 2 }
    ]);

    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# 产品规划",
        "",
        "## [[notes/project.md|project]]",
        ""
      ].join("\n")
    );
  });

  it("读取旧版 HTML 注释折叠状态，但序列化时不再写入插件注释", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "# 产品规划",
        "",
        "<!-- outline-mindmap: collapsed=true -->",
        "",
        "根节点正文。",
        "",
        "## 目标",
        "",
        "<!-- outline-mindmap: collapsed=true -->",
        "",
        "目标正文。"
      ].join("\n")
    );

    const heading = root.children[0];
    expect(heading.bodyCollapsed).toBe(true);
    expect(heading.body).toBe("根节点正文。");
    expect(heading.children[0].bodyCollapsed).toBe(true);
    expect(heading.children[0].body).toBe("目标正文。");
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# 产品规划",
        "",
        "根节点正文。",
        "",
        "## 目标",
        "",
        "目标正文。",
        ""
      ].join("\n")
    );
  });

  it("保留 YAML frontmatter 和标题前正文在文件顶部，不并入根节点正文", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "---",
        "tags:",
        "  - project",
        "---",
        "",
        "标题前说明。",
        "",
        "# 产品规划",
        "",
        "根节点正文。"
      ].join("\n")
    );

    expect(root.body).toBe("标题前说明。");
    expect(root.children[0].body).toBe("根节点正文。");
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "---",
        "tags:",
        "  - project",
        "---",
        "",
        "标题前说明。",
        "",
        "# 产品规划",
        "",
        "根节点正文。",
        ""
      ].join("\n")
    );
  });

  it("YAML frontmatter 内的 # 行不作为 Markdown 标题解析", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "---",
        "# frontmatter 注释",
        "title: 项目",
        "---",
        "",
        "# 产品规划",
        "",
        "根节点正文。"
      ].join("\n")
    );

    expect(root.children[0].title).toBe("产品规划");
    expect(root.preface).toBe(["---", "# frontmatter 注释", "title: 项目", "---"].join("\n"));
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "---",
        "# frontmatter 注释",
        "title: 项目",
        "---",
        "",
        "# 产品规划",
        "",
        "根节点正文。",
        ""
      ].join("\n")
    );
  });

  it("首行 Markdown 分隔线没有闭合 YAML 时，不把整篇内容当 frontmatter", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      ["---", "", "# 产品规划", "", "根节点正文。"].join("\n")
    );

    expect(root.children[0].title).toBe("产品规划");
    expect(root.preface).toBe("");
    expect(root.body).toBe("---");
    expect(root.children[0].body).toBe("根节点正文。");
    expect(serializeMindmapMarkdown(root)).toBe(
      ["---", "", "# 产品规划", "", "根节点正文。", ""].join("\n")
    );
  });

  it("未闭合 YAML frontmatter 后出现标题时，按普通标题继续解析", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      ["---", "title: 未闭合", "", "# 产品规划", "", "根节点正文。"].join("\n")
    );

    expect(root.children[0].title).toBe("产品规划");
    expect(root.preface).toBe("");
    expect(root.body).toBe(["---", "title: 未闭合"].join("\n"));
    expect(root.children[0].body).toBe("根节点正文。");
    expect(serializeMindmapMarkdown(root)).toBe(
      ["---", "title: 未闭合", "", "# 产品规划", "", "根节点正文。", ""].join("\n")
    );
  });

  it("首行分隔线后已经出现正文时，即使后面还有分隔线也不回头当作 YAML", () => {
    const markdown = [
      "---",
      "",
      "# 产品规划",
      "",
      "根节点正文。",
      "",
      "---",
      "",
      "后续正文。"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown);

    expect(root.children[0].title).toBe("产品规划");
    expect(root.preface).toBe("");
    expect(root.body).toBe("---");
    expect(root.children[0].body).toBe(["根节点正文。", "", "---", "", "后续正文。"].join("\n"));
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("默认不把正文列表项展开为导图子节点", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      [
        "# 产品规划",
        "",
        "- 目标一",
        "- 目标二"
      ].join("\n")
    );

    const heading = root.children[0];
    expect(heading.children).toEqual([]);
    expect(heading.body).toBe("- 目标一\n- 目标二");
  });

  it("开启列表项展开后，把正文列表项作为只读导图子节点展示且不改写 Markdown", () => {
    const markdown = [
      "# 产品规划",
      "",
      "- 目标一",
      "  - 子目标",
      "- 目标二"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([
      {
        type: "list-item",
        title: "目标一",
        children: [{ type: "list-item", title: "子目标" }]
      },
      {
        type: "list-item",
        title: "目标二"
      }
    ]);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("开启列表项展开后，也把有序列表项作为只读导图子节点展示", () => {
    const markdown = [
      "# 产品规划",
      "",
      "1. 第一阶段",
      "   1. 子任务",
      "2. 第二阶段"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([
      {
        type: "list-item",
        title: "第一阶段",
        children: [{ type: "list-item", title: "子任务" }]
      },
      {
        type: "list-item",
        title: "第二阶段"
      }
    ]);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("开启列表项展开后，保留四空格缩进的嵌套列表项", () => {
    const markdown = [
      "# 产品规划",
      "",
      "- 第一阶段",
      "    - 子任务"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([
      {
        type: "list-item",
        title: "第一阶段",
        children: [{ type: "list-item", title: "子任务" }]
      }
    ]);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("开启列表项展开后，任务列表项标题不带复选框标记", () => {
    const markdown = [
      "# 产品规划",
      "",
      "- [ ] 未完成任务",
      "- [x] 已完成任务"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([
      { type: "list-item", title: "未完成任务" },
      { type: "list-item", title: "已完成任务" }
    ]);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("开启列表项展开后，忽略代码块里的列表语法", () => {
    const markdown = [
      "# 产品规划",
      "",
      "```",
      "- 代码里的伪列表",
      "```",
      "",
      "- 真实列表"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "真实列表" }]);
    expect(root.children[0].children).toHaveLength(1);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("开启列表项展开后，按 fence marker 和长度忽略长 fence 内的列表语法", () => {
    const markdown = [
      "# 产品规划",
      "",
      "~~~~",
      "~~~",
      "- 代码里的伪列表",
      "~~~",
      "~~~~",
      "",
      "- 真实列表"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "真实列表" }]);
    expect(root.children[0].children).toHaveLength(1);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("开启列表项展开后，fence 关闭行带非空白尾随内容时仍忽略代码块内列表", () => {
    const markdown = [
      "# 产品规划",
      "",
      "```",
      "```not-close",
      "- 代码里的伪列表",
      "```",
      "",
      "- 真实列表"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "真实列表" }]);
    expect(root.children[0].children).toHaveLength(1);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("开启列表项展开后，忽略缩进代码块里的列表语法", () => {
    const markdown = [
      "# 产品规划",
      "",
      "    - 代码里的伪列表",
      "",
      "- 真实列表"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/导图.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "真实列表" }]);
    expect(root.children[0].children).toHaveLength(1);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("重复应用列表项展开时不会生成重复的虚拟节点", () => {
    const root = parseMindmapMarkdown(
      "projects/导图.md",
      ["# 产品规划", "", "- 目标一"].join("\n")
    );

    applyListItemExpansion(root, { expandListItems: true });
    applyListItemExpansion(root, { expandListItems: true });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "目标一" }]);
    expect(root.children[0].children).toHaveLength(1);
  });
});
