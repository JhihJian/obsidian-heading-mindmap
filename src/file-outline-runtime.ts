import { buildOutlineTreeFromMarkdown, type MindNode } from "./mindmap-model";

export interface FilePathRef {
  path: string;
}

export type FileNodeTargetResolver<TFile extends FilePathRef = FilePathRef> = (node: MindNode) => TFile | null;

export interface FileOutlineExpandResult {
  ok: boolean;
  message?: string;
  empty?: boolean;
}

export function findExpandedFileNode(
  root: MindNode,
  filePath: string,
  resolveTarget: FileNodeTargetResolver
): MindNode | null {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) continue;
    const file = node.type === "file" && node.outlineExpanded ? resolveTarget(node) : null;
    if (file?.path === filePath) {
      return node;
    }
    stack.unshift(...node.children);
  }
  return null;
}

export async function refreshExpandedFileOutline(
  root: MindNode,
  file: FilePathRef,
  resolveTarget: FileNodeTargetResolver,
  readMarkdown: () => Promise<string>
): Promise<boolean> {
  const node = findExpandedFileNode(root, file.path, resolveTarget);
  if (!node) return false;

  node.children = buildOutlineTreeFromMarkdown(file.path, await readMarkdown());
  node.childrenCollapsed = false;
  return true;
}

export async function expandFileOutlineNode<TFile extends FilePathRef>(
  node: MindNode,
  resolveTarget: FileNodeTargetResolver<TFile>,
  readMarkdown: (file: TFile) => Promise<string>
): Promise<FileOutlineExpandResult> {
  if (!node.filePath) {
    return { ok: false, message: "此文件节点缺少文件路径。" };
  }

  const file = resolveTarget(node);
  if (!file) {
    return { ok: false, message: `找不到 Markdown 文件：${node.filePath}` };
  }

  node.children = buildOutlineTreeFromMarkdown(file.path, await readMarkdown(file));
  node.outlineExpanded = true;
  node.childrenCollapsed = false;
  return { ok: true, empty: node.children.length === 0 };
}
