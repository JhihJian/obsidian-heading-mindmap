import { describe, expect, it } from "vitest";
import {
  getClipboardImageAttachments,
  getClipboardImageFilename,
  toImageEmbedLink
} from "../src/clipboard-image-attachments";

const fixedNow = new Date(2026, 6, 7, 10, 11, 12);

describe("clipboard image attachments", () => {
  it("从 clipboard items 提取图片文件并忽略文本项", () => {
    const image = new File(["image"], "screen.png", { type: "image/png" });
    const attachments = getClipboardImageAttachments(
      {
        items: [
          { kind: "string", type: "text/plain" },
          { kind: "file", type: "image/png", getAsFile: () => image }
        ]
      },
      fixedNow
    );

    expect(attachments).toEqual([{ file: image, filename: "screen.png" }]);
  });

  it("clipboard items 不含图片时回退读取 files", () => {
    const image = new File(["image"], "diagram.webp", { type: "" });
    const text = new File(["text"], "note.txt", { type: "text/plain" });
    const attachments = getClipboardImageAttachments(
      {
        items: [{ kind: "string", type: "text/plain" }],
        files: [text, image]
      },
      fixedNow
    );

    expect(attachments).toEqual([{ file: image, filename: "diagram.webp" }]);
  });

  it("剪贴板图片缺少文件名时按 MIME 类型生成稳定附件名", () => {
    const file = new File(["image"], "", { type: "image/jpeg" });

    expect(getClipboardImageFilename(file, 1, fixedNow)).toBe("pasted-image-20260707-101112-2.jpg");
  });

  it("清理不适合放入附件名的字符", () => {
    const file = new File(["image"], "bad:name?.png", { type: "image/png" });

    expect(getClipboardImageFilename(file, 0, fixedNow)).toBe("bad-name-.png");
  });

  it("把普通 Markdown 链接规范化为图片嵌入链接", () => {
    expect(toImageEmbedLink("[[assets/image.png]]")).toBe("![[assets/image.png]]");
    expect(toImageEmbedLink("![[assets/image.png]]")).toBe("![[assets/image.png]]");
  });
});
