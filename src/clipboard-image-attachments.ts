export interface ClipboardImageAttachment {
  file: File;
  filename: string;
}

interface ClipboardItemLike {
  kind?: string;
  type?: string;
  getAsFile?: () => File | null;
}

interface ClipboardDataLike {
  items?: ArrayLike<ClipboardItemLike> | null;
  files?: ArrayLike<File> | null;
}

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif"
};

const IMAGE_EXTENSIONS = new Set(Object.values(IMAGE_EXTENSION_BY_MIME).concat("jpeg"));

export function getClipboardImageAttachments(
  clipboardData: ClipboardDataLike | null | undefined,
  now = new Date()
): ClipboardImageAttachment[] {
  if (!clipboardData) return [];

  const files = collectImageFilesFromItems(clipboardData.items);
  if (files.length === 0) {
    files.push(...collectImageFiles(clipboardData.files));
  }

  return files.map((file, index) => ({
    file,
    filename: getClipboardImageFilename(file, index, now)
  }));
}

export function getClipboardImageFilename(file: Pick<File, "name" | "type">, index = 0, now = new Date()): string {
  const sanitizedName = sanitizeAttachmentFilename(file.name);
  if (sanitizedName && hasImageExtension(sanitizedName)) {
    return sanitizedName;
  }

  const extension = getImageExtension(file) ?? "png";
  const baseName = sanitizedName || `pasted-image-${formatTimestampForFilename(now)}`;
  const suffix = index > 0 ? `-${index + 1}` : "";
  return `${baseName}${suffix}.${extension}`;
}

export function toImageEmbedLink(markdownLink: string): string {
  return markdownLink.startsWith("!") ? markdownLink : `!${markdownLink}`;
}

function collectImageFilesFromItems(items: ArrayLike<ClipboardItemLike> | null | undefined): File[] {
  if (!items) return [];

  const files: File[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || item.kind !== "file" || !isImageMime(item.type)) continue;
    const file = item.getAsFile?.();
    if (file) files.push(file);
  }
  return files;
}

function collectImageFiles(files: ArrayLike<File> | null | undefined): File[] {
  if (!files) return [];

  const imageFiles: File[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (file && isImageFile(file)) imageFiles.push(file);
  }
  return imageFiles;
}

function isImageFile(file: Pick<File, "name" | "type">): boolean {
  return isImageMime(file.type) || hasImageExtension(file.name);
}

function isImageMime(type: string | undefined): boolean {
  return Boolean(type?.toLowerCase().startsWith("image/"));
}

function getImageExtension(file: Pick<File, "name" | "type">): string | undefined {
  const mime = file.type.toLowerCase().split(";")[0]?.trim();
  return IMAGE_EXTENSION_BY_MIME[mime] ?? getImageExtensionFromName(file.name);
}

function hasImageExtension(name: string): boolean {
  return getImageExtensionFromName(name) !== undefined;
}

function getImageExtensionFromName(name: string): string | undefined {
  const extension = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return extension && IMAGE_EXTENSIONS.has(extension) ? extension : undefined;
}

function sanitizeAttachmentFilename(name: string): string {
  const basename = name.split(/[\\/]/).pop()?.trim() ?? "";
  return basename
    .replace(/[<>:"|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .slice(0, 128);
}

function formatTimestampForFilename(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}
