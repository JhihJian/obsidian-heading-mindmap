export type MindmapStateLoadPolicy = "await-state" | "load-file" | "activate-default";

export function decideMindmapStateLoadPolicy(
  filePath: string | undefined,
  hasLeafState: boolean
): MindmapStateLoadPolicy {
  if (filePath) return "load-file";
  if (hasLeafState) return "activate-default";
  return "await-state";
}
