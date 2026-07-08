export type HeadingMindmapLocale = "en" | "zh";

export type HeadingMindmapStrings = {
  commands: {
    open: string;
    toggleListItemExpansion: string;
  };
  ribbon: {
    open: string;
  };
};

const STRINGS: Record<HeadingMindmapLocale, HeadingMindmapStrings> = {
  en: {
    commands: {
      open: "Open mind map",
      toggleListItemExpansion: "Toggle body list items in mind map"
    },
    ribbon: {
      open: "Open mind map"
    }
  },
  zh: {
    commands: {
      open: "打开思维导图",
      toggleListItemExpansion: "切换正文列表项在导图中展示"
    },
    ribbon: {
      open: "打开思维导图"
    }
  }
};

export function resolveHeadingMindmapLocale(language: string | null | undefined): HeadingMindmapLocale {
  const normalized = (language ?? "en").toLowerCase();
  return normalized.startsWith("zh") ? "zh" : "en";
}

export function getHeadingMindmapStrings(language: string | null | undefined): HeadingMindmapStrings {
  return STRINGS[resolveHeadingMindmapLocale(language)];
}
