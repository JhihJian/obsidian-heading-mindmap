import { getStoredViewportState, type StoredMindmapState } from "./mindmap-view-state";

export type HeadingMindmapPluginData = {
  files: Record<string, StoredMindmapState>;
  expandListItems: boolean;
};

export function normalizePluginData(value: unknown): HeadingMindmapPluginData {
  if (!value || typeof value !== "object") {
    return { files: {}, expandListItems: false };
  }

  const files = (value as Partial<HeadingMindmapPluginData>).files;
  if (!files || typeof files !== "object") {
    return {
      files: {},
      expandListItems: Boolean((value as Partial<HeadingMindmapPluginData>).expandListItems)
    };
  }

  return {
    expandListItems: Boolean((value as Partial<HeadingMindmapPluginData>).expandListItems),
    files: Object.fromEntries(
      Object.entries(files)
        .filter(([path, state]) => path && state && typeof state === "object")
        .map(([path, state]) => [
          path,
          {
            collapsedNodeKeys: Array.isArray((state as Partial<StoredMindmapState>).collapsedNodeKeys)
              ? (state as Partial<StoredMindmapState>).collapsedNodeKeys!.filter(
                  (key): key is string => typeof key === "string"
                )
              : [],
            expandedFileNodeKeys: Array.isArray((state as Partial<StoredMindmapState>).expandedFileNodeKeys)
              ? (state as Partial<StoredMindmapState>).expandedFileNodeKeys!.filter(
                  (key): key is string => typeof key === "string"
                )
              : [],
            viewport: getStoredViewportState(state)
          }
        ])
    )
  };
}
