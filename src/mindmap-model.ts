export type MindNodeType = "text" | "file" | "heading" | "list-item";

export type OutlineHeading = {
  heading: string;
  level: number;
};

export type MindNode = {
  id: string;
  type: MindNodeType;
  title: string;
  body: string;
  bodyCollapsed: boolean;
  childrenCollapsed?: boolean;
  children: MindNode[];
  filePath?: string;
  headingLevel?: number;
  outlineExpanded?: boolean;
  preface?: string;
  virtual?: boolean;
};

type SerializedMindNode = Omit<MindNode, "children"> & {
  children?: SerializedMindNode[];
};

type MarkdownSection = {
  level: number;
  title: string;
  body: string;
  bodyCollapsed: boolean;
};

type FenceState = {
  marker: "`" | "~";
  length: number;
};

export type ParseMindmapOptions = {
  expandListItems?: boolean;
};

const COLLAPSED_COMMENTS = new Set([
  "<!-- heading-mindmap: collapsed=true -->",
  "<!-- outline-mindmap: collapsed=true -->"
]);

export function createStarterMindmap(): MindNode {
  return {
    id: "root",
    type: "text",
    title: "我的思维导图",
    body: "在这里写主题说明。上方导图编辑标题结构，下方正文区域查看和编辑当前节点正文。",
    bodyCollapsed: false,
    childrenCollapsed: false,
    children: []
  };
}

export function createFileNode(filePath: string): MindNode {
  return {
    id: createNodeId("file"),
    type: "file",
    title: getFileTitle(filePath),
    body: "",
    bodyCollapsed: false,
    childrenCollapsed: false,
    children: [],
    filePath,
    outlineExpanded: false
  };
}

export function createTextNode(title = "新节点", body = ""): MindNode {
  return {
    id: createNodeId("text"),
    type: "text",
    title,
    body,
    bodyCollapsed: false,
    childrenCollapsed: false,
    children: []
  };
}

export function buildOutlineTree(filePath: string, headings: OutlineHeading[]): MindNode[] {
  const roots: MindNode[] = [];
  const stack: MindNode[] = [];

  for (const heading of headings) {
    const title = heading.heading.trim();
    if (!title) continue;

    const level = Math.max(1, heading.level);
    const node: MindNode = {
      id: createNodeId("heading"),
      type: "heading",
      title,
      body: "",
      bodyCollapsed: true,
      childrenCollapsed: false,
      children: [],
      filePath,
      headingLevel: level
    };

    while (stack.length > 0 && (stack[stack.length - 1].headingLevel ?? 1) >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    stack.push(node);
  }

  return roots;
}

export function buildOutlineTreeFromMarkdown(filePath: string, markdown: string): MindNode[] {
  const { sections } = splitMarkdownSections(markdown);
  const root = parseMindmapMarkdown(filePath, markdown);
  if (sections[0]?.level === 1) {
    return [root];
  }
  return root.children;
}

export function serializeMindmap(root: MindNode): string {
  return JSON.stringify(root, null, 2);
}

export function deserializeMindmap(serialized: string): MindNode {
  const parsed = JSON.parse(serialized) as SerializedMindNode;
  return normalizeNode(parsed);
}

export function parseMindmapMarkdown(
  filePath: string,
  markdown: string,
  options: ParseMindmapOptions = {}
): MindNode {
  const { preface, frontmatter, prefaceBody, prefaceBodyCollapsed, sections } = splitMarkdownSections(markdown);

  if (sections.length === 0) {
    const root: MindNode = {
      id: "root",
      type: "heading",
      title: getFileTitle(filePath),
      body: prefaceBody,
      bodyCollapsed: prefaceBodyCollapsed,
      childrenCollapsed: false,
      children: [],
      filePath,
      headingLevel: 1,
      preface: frontmatter
    };
    applyListItemExpansion(root, options);
    return root;
  }

  const firstSection = sections[0];
  const hasExplicitRoot = firstSection.level === 1;
  const root = hasExplicitRoot
    ? createHeadingNode(filePath, firstSection)
    : {
        id: "root",
        type: "heading" as const,
        title: getFileTitle(filePath),
        body: "",
        bodyCollapsed: false,
        children: [],
        filePath,
        headingLevel: 1,
        preface
      };

  if (hasExplicitRoot) {
    root.preface = preface;
  }

  const stack: MindNode[] = [root];
  const childSections = hasExplicitRoot ? sections.slice(1) : sections;

  for (const section of childSections) {
    const node = createHeadingNode(filePath, section);

    while (
      stack.length > 1 &&
      (stack[stack.length - 1].headingLevel ?? 1) >= section.level
    ) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  applyListItemExpansion(root, options);
  return root;
}

export function applyListItemExpansion(root: MindNode, options: ParseMindmapOptions): void {
  removeVirtualNodes(root);
  if (!options.expandListItems) return;
  expandListItemsForNode(root);
}

export function serializeMindmapMarkdown(root: MindNode): string {
  const lines: string[] = [];

  function writeNode(node: MindNode, fallbackLevel: number): void {
    const level = clampHeadingLevel(node.headingLevel ?? fallbackLevel);
    lines.push(`${"#".repeat(level)} ${formatMarkdownTitle(node)}`);

    const body = trimBlankLines(node.body);
    if (body) {
      lines.push("", body);
    }

    if ((node.type === "file" && node.outlineExpanded) || node.virtual) {
      return;
    }

    for (const child of node.children) {
      if (child.virtual) continue;
      lines.push("");
      writeNode(child, level + 1);
    }
  }

  const preface = trimBlankLines(root.preface ?? "");
  if (preface) {
    lines.push(preface, "");
  }
  writeNode(root, 1);
  lines.push("");
  return lines.join("\n");
}

export function getFileTitle(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  const fileName = normalized.split("/").pop() ?? filePath;
  return fileName.replace(/\.md$/i, "");
}

function normalizeNode(node: SerializedMindNode): MindNode {
  return {
    id: node.id || createNodeId(node.type || "text"),
    type: node.type || "text",
    title: node.title || "未命名节点",
    body: node.body || "",
    bodyCollapsed: Boolean(node.bodyCollapsed),
    childrenCollapsed: Boolean(node.childrenCollapsed),
    children: (node.children || []).map(normalizeNode),
    filePath: node.filePath,
    headingLevel: node.headingLevel,
    outlineExpanded: node.outlineExpanded,
    preface: node.preface,
    virtual: Boolean(node.virtual)
  };
}

function createNodeId(prefix: MindNodeType): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitMarkdownSections(markdown: string): {
  preface: string;
  frontmatter: string;
  prefaceBody: string;
  prefaceBodyCollapsed: boolean;
  sections: MarkdownSection[];
} {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const sections: MarkdownSection[] = [];
  const prefaceLines: string[] = [];
  const frontmatterLines: string[] = [];
  const prefaceBodyLines: string[] = [];
  let current: { level: number; title: string; bodyLines: string[] } | null = null;
  let fence: FenceState | null = null;
  let inFrontmatter = hasClosedFrontmatter(lines);
  let frontmatterLineIndex = 0;

  for (const line of lines) {
    if (inFrontmatter) {
      prefaceLines.push(line);
      frontmatterLines.push(line);
      frontmatterLineIndex += 1;
      if (frontmatterLineIndex > 1 && isFrontmatterDelimiter(line)) {
        inFrontmatter = false;
      }
      continue;
    }

    fence = updateFenceState(fence, line);

    const heading = fence ? null : parseHeadingLine(line);
    if (heading) {
      if (current) {
        sections.push({
          level: current.level,
          title: current.title,
          ...parseSectionBody(current.bodyLines.join("\n"))
        });
      }
      current = { ...heading, bodyLines: [] };
      continue;
    }

    if (current) {
      current.bodyLines.push(line);
    } else {
      prefaceLines.push(line);
      prefaceBodyLines.push(line);
    }
  }

  if (current) {
    sections.push({
      level: current.level,
      title: current.title,
      ...parseSectionBody(current.bodyLines.join("\n"))
    });
  }

  const parsedPrefaceBody = parseSectionBody(prefaceBodyLines.join("\n"));
  return {
    preface: trimBlankLines(prefaceLines.join("\n")),
    frontmatter: trimBlankLines(frontmatterLines.join("\n")),
    prefaceBody: parsedPrefaceBody.body,
    prefaceBodyCollapsed: parsedPrefaceBody.bodyCollapsed,
    sections
  };
}

function hasClosedFrontmatter(lines: string[]): boolean {
  if (!isFrontmatterDelimiter(lines[0] ?? "")) return false;
  if (!lines[1]?.trim()) return false;
  for (const line of lines.slice(1)) {
    if (isFrontmatterDelimiter(line)) return true;
  }
  return false;
}

function isFrontmatterDelimiter(line: string): boolean {
  return /^---\s*$/.test(line);
}

function parseHeadingLine(line: string): { level: number; title: string } | null {
  const match = /^ {0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
  if (!match) return null;

  return {
    level: match[1].length,
    title: match[2].replace(/\s+#+\s*$/, "").trim()
  };
}

function updateFenceState(current: FenceState | null, line: string): FenceState | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  if (!match) return current;

  const marker = match[1][0] as "`" | "~";
  const length = match[1].length;
  if (!current) {
    return { marker, length };
  }
  const closingPattern = new RegExp(`^ {0,3}\\${current.marker}{${current.length},}[ \\t]*$`);
  if (current.marker === marker && length >= current.length && closingPattern.test(line)) {
    return null;
  }
  return current;
}

function createHeadingNode(filePath: string, section: MarkdownSection): MindNode {
  const fileLink = parseFileLinkTitle(section.title);
  if (fileLink) {
    return {
      id: createNodeId("file"),
      type: "file",
      title: fileLink.title,
      body: section.body,
      bodyCollapsed: section.bodyCollapsed,
      childrenCollapsed: false,
      children: [],
      filePath: fileLink.path,
      headingLevel: section.level,
      outlineExpanded: false
    };
  }

  return {
    id: createNodeId("heading"),
    type: "heading",
    title: section.title,
    body: section.body,
    bodyCollapsed: section.bodyCollapsed,
    childrenCollapsed: false,
    children: [],
    filePath,
    headingLevel: section.level
  };
}

function trimBlankLines(value: string): string {
  return value.replace(/^\s*\n/, "").replace(/\n\s*$/, "");
}

function parseSectionBody(body: string): Pick<MarkdownSection, "body" | "bodyCollapsed"> {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const bodyLines: string[] = [];
  let bodyCollapsed = false;

  for (const line of lines) {
    if (COLLAPSED_COMMENTS.has(line.trim())) {
      bodyCollapsed = true;
      continue;
    }
    bodyLines.push(line);
  }

  return {
    body: trimBlankLines(bodyLines.join("\n")),
    bodyCollapsed
  };
}

function clampHeadingLevel(level: number): number {
  return Math.max(1, Math.min(6, level));
}

function parseFileLinkTitle(title: string): { path: string; title: string } | null {
  const match = /^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/.exec(title.trim());
  if (!match) return null;

  const rawPath = stripObsidianSubpath(match[1].trim());
  if (!rawPath) return null;
  const path = rawPath.toLowerCase().endsWith(".md") ? rawPath : `${rawPath}.md`;

  return {
    path,
    title: getFileTitle(path)
  };
}

function stripObsidianSubpath(path: string): string {
  return path.split(/[#^]/, 1)[0].trim();
}

function formatMarkdownTitle(node: MindNode): string {
  if (node.type === "file" && node.filePath) {
    return `[[${node.filePath}|${getFileTitle(node.filePath)}]]`;
  }

  return node.title.trim() || "未命名节点";
}

function expandListItemsForNode(node: MindNode): void {
  const listItems = buildListItemNodes(node.body, node.filePath, node.headingLevel);
  node.children.unshift(...listItems);
  for (const child of node.children) {
    if (!child.virtual) {
      expandListItemsForNode(child);
    }
  }
}

function removeVirtualNodes(node: MindNode): void {
  node.children = node.children.filter((child) => !child.virtual);
  for (const child of node.children) {
    removeVirtualNodes(child);
  }
}

function buildListItemNodes(body: string, filePath?: string, headingLevel?: number): MindNode[] {
  const roots: MindNode[] = [];
  const stack: Array<{ indent: number; node: MindNode }> = [];
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let fence: FenceState | null = null;

  for (const line of lines) {
    const nextFence = updateFenceState(fence, line);
    if (nextFence !== fence) {
      fence = nextFence;
      continue;
    }
    if (fence) continue;

    const match = /^(\s*)(?:[-*+]|\d+[.)])\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    if (stack.length === 0 && /^(?: {4,}|\t)/.test(line)) continue;

    const indent = Math.floor(match[1].replace(/\t/g, "  ").length / 2);
    const title = stripInlineMarkdown(match[2]);
    const node: MindNode = {
      id: createNodeId("list-item"),
      type: "list-item",
      title,
      body: "",
      bodyCollapsed: true,
      childrenCollapsed: false,
      children: [],
      filePath,
      headingLevel,
      virtual: true
    };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]?.node;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push({ indent, node });
  }

  return roots;
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/^\[[ xX]\]\s+/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}
