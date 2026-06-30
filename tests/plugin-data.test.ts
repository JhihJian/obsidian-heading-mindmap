import { describe, expect, it } from "vitest";
import { normalizePluginData } from "../src/plugin-data";

describe("plugin data", () => {
  it("空数据归一化为默认插件状态", () => {
    expect(normalizePluginData(null)).toEqual({
      files: {},
      expandListItems: false
    });
  });

  it("保留有效文件状态并过滤非法持久化键", () => {
    const data = normalizePluginData({
      expandListItems: true,
      files: {
        "notes/map.md": {
          collapsedNodeKeys: ["root[0]", 1, null],
          expandedFileNodeKeys: ["root[0]/file[0]", false],
          viewport: { scale: 3, scrollLeft: -4, scrollTop: 24 },
          bodyPane: { heightRatio: 0.9, minimized: true }
        },
        "": {
          collapsedNodeKeys: ["ignored"]
        },
        "notes/broken.md": null
      }
    });

    expect(data).toEqual({
      expandListItems: true,
      files: {
        "notes/map.md": {
          collapsedNodeKeys: ["root[0]"],
          expandedFileNodeKeys: ["root[0]/file[0]"],
          viewport: { scale: 2, scrollLeft: 0, scrollTop: 24 },
          bodyPane: { heightRatio: 0.8, minimized: true }
        }
      }
    });
  });
});
