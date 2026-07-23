export type MarkdownFileOption = {
  path: string;
};

export function getFileNodeOptions<T extends MarkdownFileOption>(files: T[], currentFilePath: string | undefined): T[] {
  return files.filter((file) => file.path !== currentFilePath);
}
