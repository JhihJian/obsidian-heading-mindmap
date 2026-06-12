export type MindmapLeafCandidate = {
  filePath?: string;
};

export type MindmapOpenPolicy = "reuse-current-mindmap" | "open-in-new-tab";

export function decideMindmapOpenPolicy(
  activeMindmap: MindmapLeafCandidate | null,
  targetFilePath: string
): MindmapOpenPolicy {
  if (activeMindmap?.filePath === targetFilePath) return "reuse-current-mindmap";
  return "open-in-new-tab";
}
