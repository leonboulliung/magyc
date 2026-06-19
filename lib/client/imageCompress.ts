/**
 * Client-side image compression before upload.
 *
 * Uses `browser-image-compression` (MIT) — a canvas + Web-Worker compressor
 * that handles the common raster formats the browser can decode (JPEG, PNG,
 * WebP). It runs off the main thread, downsizes to a sane max dimension, and
 * re-encodes under a target size. This keeps every upload well under the
 * platform's request-body ceiling and makes multi-image uploads reliable.
 *
 * Formats we deliberately pass through untouched:
 *  - GIF: would lose animation if rasterised.
 *  - SVG: vector; nothing to compress.
 *  - HEIC/HEIF: most browsers (Chrome) can't decode it on a canvas, so the
 *    library throws — we fall back to the original. (A HEIC→JPEG converter is
 *    a sensible follow-up if iPhone-native files become common.)
 *
 * The import is dynamic so the library never ships in the SSR/initial bundle.
 */

const PASSTHROUGH = new Set(["image/gif", "image/svg+xml"]);

export interface CompressOptions {
  /** Target ceiling for the output in MB. */
  maxSizeMB?: number;
  /** Longest edge after downscale, in px. */
  maxWidthOrHeight?: number;
}

export async function compressImageFile(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || PASSTHROUGH.has(file.type)) return file;

  try {
    const { default: imageCompression } = await import("browser-image-compression");
    const out = await imageCompression(file, {
      maxSizeMB: opts.maxSizeMB ?? 1.6,
      maxWidthOrHeight: opts.maxWidthOrHeight ?? 2560,
      useWebWorker: true,
      initialQuality: 0.82,
    });
    // Only adopt the compressed result if it actually shrank the file; keep
    // the original name so the stored filename stays meaningful.
    if (out.size > 0 && out.size < file.size) {
      return new File([out], file.name, { type: out.type || file.type, lastModified: Date.now() });
    }
    return file;
  } catch {
    // Decode/compression failed (e.g. HEIC on Chrome) — upload the original
    // and let the size guard handle anything still too large.
    return file;
  }
}
