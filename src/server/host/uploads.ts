import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Accepted photo types and the extension we store them under. */
export const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** sharp's format names for the accepted types, used to check the bytes match the declared type. */
const SHARP_FORMATS: Record<string, string[]> = {
  "image/jpeg": ["jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["heif", "avif"],
};

export class UploadError extends Error {
  constructor(
    public readonly status: 400 | 413 | 415 | 503,
    message: string,
  ) {
    super(message);
  }
}

export type StoredImage = { url: string; width: number | null; height: number | null; contentType: string; size: number };

/** Checks type and size, reads the dimensions and stores the file. */
export async function storeImage(file: File, opts: { folder: string }): Promise<StoredImage> {
  const ext = ACCEPTED_TYPES[file.type];
  if (!ext) throw new UploadError(415, "Upload a JPEG, PNG, WebP or AVIF image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(413, "That photo is larger than 10 MB. Export it smaller and try again.");
  if (file.size === 0) throw new UploadError(400, "That file is empty.");

  const original = Buffer.from(await file.arrayBuffer());
  let width: number | null = null;
  let height: number | null = null;
  let bytes: Buffer;
  try {
    const meta = await sharp(original).metadata();
    if (!meta.format || !SHARP_FORMATS[file.type].includes(meta.format)) throw new Error("format mismatch");
    width = meta.autoOrient?.width ?? meta.width ?? null;
    height = meta.autoOrient?.height ?? meta.height ?? null;
    // Re-encode in the same format with the rotation applied. sharp drops EXIF by default, so the
    // published photo carries no GPS position, camera serial or capture time from the host's phone.
    bytes = await reencode(original, file.type);
  } catch {
    throw new UploadError(415, "That file is not a readable image. Try exporting it again as JPEG.");
  }

  const name = `${opts.folder}/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`listings/${name}`, bytes, { access: "public", contentType: file.type, addRandomSuffix: false });
    return { url: blob.url, width, height, contentType: file.type, size: bytes.length };
  }

  if (process.env.NODE_ENV === "production") {
    throw new UploadError(503, "Photo storage is not set up. Set BLOB_READ_WRITE_TOKEN to accept uploads.");
  }

  // Development fallback: write under public/uploads so `next dev` serves it.
  const dir = path.join(process.cwd(), "public", "uploads", path.dirname(name));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(process.cwd(), "public", "uploads", name), bytes);
  return { url: `/uploads/${name}`, width, height, contentType: file.type, size: bytes.length };
}

function reencode(input: Buffer, type: string) {
  const img = sharp(input).rotate().keepIccProfile();
  switch (type) {
    case "image/png":
      return img.png().toBuffer();
    case "image/webp":
      return img.webp({ quality: 90 }).toBuffer();
    case "image/avif":
      return img.avif({ quality: 70 }).toBuffer();
    default:
      return img.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  }
}
