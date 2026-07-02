export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
export const DEFAULT_MAX_UPLOAD_MB = MAX_UPLOAD_SIZE_BYTES / 1024 / 1024;
export const PROJECT_UPLOAD_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
export const AUDIO_ACCEPT = "audio/mpeg,audio/wav,audio/mp4,audio/aac";

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const AUDIO_MIMES = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac"];
const ALLOWED_MIME_PREFIXES = [
  ...IMAGE_MIMES,
  "image/gif",
  ...AUDIO_MIMES,
  "video/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats",
  "application/vnd.oasis",
  "text/plain",
  "text/markdown",
  "text/csv",
];

export function isMimeAllowed(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export function isMimeAllowedForModule(moduleType: unknown, mime: string): boolean {
  if (!isMimeAllowed(mime)) return false;
  if (moduleType === "attachments") return true;
  if (moduleType === "images" || moduleType === "moodboard" || moduleType === "selection" || moduleType === "parts_list") return IMAGE_MIMES.includes(mime);
  if (moduleType === "audio") return AUDIO_MIMES.includes(mime);
  return false;
}

export function canAccessUnstagedUpload(input: {
  actorUserId: string | null;
  actorAnonToken: string | null;
  ownerId: string | null;
  ownerAnonToken: string | null;
  visibility: string | null;
}): boolean {
  if (input.actorUserId && input.actorUserId === input.ownerId) return true;
  if (input.visibility === "public") return true;
  return !!input.actorAnonToken && input.actorAnonToken === input.ownerAnonToken;
}
