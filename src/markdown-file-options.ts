export type MarkdownFileOption = {
  path: string;
};

export function getFileNodeOptions(files: MarkdownFileOption[], currentFilePath: string | undefined): MarkdownFileOption[] {
  return files.filter((file) => file.path !== currentFilePath);
}
