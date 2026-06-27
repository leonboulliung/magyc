export function assetApiBase(id: string): string {
  if (id.startsWith("preset:")) {
    return `/api/studio/presets/${encodeURIComponent(id.slice("preset:".length))}`;
  }
  return `/api/spaces/${encodeURIComponent(id)}`;
}
