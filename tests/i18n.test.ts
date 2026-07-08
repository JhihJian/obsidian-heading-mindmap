import { describe, expect, it } from "vitest";
import { getHeadingMindmapStrings, resolveHeadingMindmapLocale } from "../src/i18n";

describe("heading mindmap localization", () => {
  it("非中文语言默认显示英文命令", () => {
    const strings = getHeadingMindmapStrings("en");

    expect(resolveHeadingMindmapLocale("en")).toBe("en");
    expect(strings.commands.open).toBe("Open mind map");
    expect(strings.commands.toggleListItemExpansion).toBe("Toggle body list items in mind map");
  });

  it("中文语言显示中文命令", () => {
    const strings = getHeadingMindmapStrings("zh-TW");

    expect(resolveHeadingMindmapLocale("zh-CN")).toBe("zh");
    expect(resolveHeadingMindmapLocale("zh-TW")).toBe("zh");
    expect(strings.commands.open).toBe("打开思维导图");
    expect(strings.commands.toggleListItemExpansion).toBe("切换正文列表项在导图中展示");
  });

  it("缺少语言值时回退到英文", () => {
    expect(getHeadingMindmapStrings(undefined).commands.open).toBe("Open mind map");
  });
});
