export type ActiveFileCandidate = {
  path: string;
  extension: string;
};

export function chooseMindmapSourcePath(
  activeMindmapFilePath: string | undefined,
  activeFile: ActiveFileCandidate | null | undefined,
  defaultPath: string
): string {
  if (activeMindmapFilePath) return activeMindmapFilePath;
  if (activeFile?.extension === "md") return activeFile.path;
  return defaultPath;
}
