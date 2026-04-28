// Storage abstraction for user-uploaded assets (images today; PDFs,
// fonts, etc later). Filesystem-backed for the dev / single-instance
// deployment we ship today; swap to S3 / R2 by re-implementing the
// interface in another module.
//
// Files live under `./uploads/{userId}/{templateId}/{stem}-{slug}.{ext}`
// — userId/templateId in the path so we can enforce ownership at
// serve time without a DB lookup, and the stem (random hex) prevents
// filename collisions across uploads of the same name.

import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export type StoredFile = {
  /** Path relative to the uploads root. Persisted on the widget config. */
  relativePath: string;
  /** Reported MIME type at upload time. */
  contentType: string;
  /** Size in bytes. */
  size: number;
};

const ROOT = resolve(process.cwd(), "uploads");

function safeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function safeFilename(original: string): string {
  const cleaned = safeSegment(original).slice(0, 80);
  // Random 8-char prefix prevents collisions when two uploads share a
  // filename. Keep the original tail so the user can recognize it.
  const stem = randomBytes(4).toString("hex");
  return `${stem}-${cleaned || "file"}`;
}

/**
 * Persist a single uploaded file. Validates MIME + size; returns the
 * relative path the caller should store in widget config.
 */
export async function saveImage(args: {
  userId: string;
  templateId: string;
  file: File;
}): Promise<StoredFile> {
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      args.file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    throw new Error(
      `Tipe file tidak didukung: ${args.file.type}. Gunakan JPG, PNG, WEBP, atau GIF.`,
    );
  }
  if (args.file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `File terlalu besar (${Math.round(args.file.size / 1024)} KB). Maksimum ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    );
  }

  const userDir = safeSegment(args.userId);
  const templateDir = safeSegment(args.templateId);
  const relativeDir = join(userDir, templateDir);
  const absoluteDir = join(ROOT, relativeDir);

  if (!existsSync(absoluteDir)) {
    await mkdir(absoluteDir, { recursive: true });
  }

  const filename = safeFilename(args.file.name);
  const absolutePath = join(absoluteDir, filename);
  const buffer = Buffer.from(await args.file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    relativePath: join(relativeDir, filename).replace(/\\/g, "/"),
    contentType: args.file.type,
    size: args.file.size,
  };
}

/**
 * Read a stored file by its relative path. Validates the path stays
 * inside the uploads root (rejects `..` traversal). Returns null when
 * the file doesn't exist.
 */
export async function readStoredImage(
  relativePath: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const absolutePath = resolve(ROOT, relativePath);
  // Path-traversal guard: resolved path must remain under ROOT.
  if (!absolutePath.startsWith(ROOT + "\\") && !absolutePath.startsWith(ROOT + "/")) {
    return null;
  }
  if (!existsSync(absolutePath)) return null;

  const buffer = await readFile(absolutePath);
  const ext = absolutePath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  return { buffer, contentType };
}

/** Best-effort delete; swallows ENOENT. */
export async function deleteStoredImage(relativePath: string): Promise<void> {
  const absolutePath = resolve(ROOT, relativePath);
  if (
    !absolutePath.startsWith(ROOT + "\\") &&
    !absolutePath.startsWith(ROOT + "/")
  ) {
    return;
  }
  try {
    await unlink(absolutePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Verify ownership: relativePath must start with the user's id segment.
 * Used by the public serve route before streaming bytes.
 */
export function checkImageOwnership(args: {
  userId: string;
  relativePath: string;
}): boolean {
  const userPrefix = safeSegment(args.userId) + "/";
  // Normalize backslashes that may sneak in from path.join on Windows.
  const normalized = args.relativePath.replace(/\\/g, "/");
  return normalized.startsWith(userPrefix);
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
