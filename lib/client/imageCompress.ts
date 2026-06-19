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

export function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  return t === "image/heic" || t === "image/heif" || /\.(heic|heif)$/i.test(file.name);
}

export async function compressImageFile(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  let working = file;

  // iPhone-native HEIC/HEIF can't be canvas-decoded by most browsers (and
  // won't display in an <img> on Chrome), so convert it to JPEG up front.
  if (isHeic(file)) {
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      working = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
    } catch {
      return file; // conversion failed — fall back to the original
    }
  }

  if (!working.type.startsWith("image/") || PASSTHROUGH.has(working.type)) return working;

  try {
    const { default: imageCompression } = await import("browser-image-compression");
    const out = await imageCompression(working, {
      maxSizeMB: opts.maxSizeMB ?? 1.6,
      maxWidthOrHeight: opts.maxWidthOrHeight ?? 2560,
      useWebWorker: true,
      initialQuality: 0.82,
    });
    // Only adopt the compressed result if it actually shrank the file; keep
    // the (possibly converted) name so the stored filename stays meaningful.
    if (out.size > 0 && out.size < working.size) {
      return new File([out], working.name, { type: out.type || working.type, lastModified: Date.now() });
    }
    return working;
  } catch {
    // Compression failed — upload the (converted) file and let the size guard
    // handle anything still too large.
    return working;
  }
}
