import { ALLOWED_MODULE_TYPES, type CardModule } from "@/lib/types";

const ALLOWED_SET: Set<string> = new Set(ALLOWED_MODULE_TYPES);

/**
 * Sanitize an arbitrary `modules` payload coming from a client into the
 * typed CardModule shape. Rules per type are documented in the source
 * union; the high-level guarantees are:
 *
 * - Each entry's `type` must be in ALLOWED_MODULE_TYPES (the live
 *   whitelist) — anything else is silently dropped.
 * - Per-type field caps protect the JSONB column from being blown up
 *   by a misbehaving client (e.g. a 10MB caption).
 * - The whole array caps at ONE — a thing carries at most one module.
 *
 * Used by both POST /api/cards (initial create) and PATCH
 * /api/cards/[id] (later edits), so the contract on both sides is
 * identical.
 */
export function sanitizeModules(raw: unknown[]): CardModule[] {
  if (!Array.isArray(raw)) return [];
  const out: CardModule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.type !== "string" || !ALLOWED_SET.has(rec.type)) continue;

    switch (rec.type) {
      case "brief": {
        if (typeof rec.text === "string") {
          const t = rec.text.trim().slice(0, 240);
          if (t) out.push({ type: "brief", text: t });
        }
        break;
      }
      case "roadmap": {
        if (Array.isArray(rec.steps)) {
          const steps: string[] = [];
          for (const s of rec.steps) {
            if (typeof s !== "string") continue;
            const v = s.trim().replace(/\s+/g, " ").slice(0, 160);
            if (v) steps.push(v);
            if (steps.length >= 8) break;
          }
          if (steps.length > 0) out.push({ type: "roadmap", steps });
        }
        break;
      }
      case "checklist": {
        if (Array.isArray(rec.items)) {
          const items: string[] = [];
          for (const s of rec.items) {
            if (typeof s !== "string") continue;
            const v = s.trim().slice(0, 160);
            if (v) items.push(v);
            if (items.length >= 12) break;
          }
          if (items.length > 0) out.push({ type: "checklist", items });
        }
        break;
      }
      case "bring": {
        if (Array.isArray(rec.items)) {
          const items: string[] = [];
          for (const s of rec.items) {
            if (typeof s !== "string") continue;
            const v = s.trim().slice(0, 80);
            if (v) items.push(v);
            if (items.length >= 16) break;
          }
          if (items.length > 0) out.push({ type: "bring", items });
        }
        break;
      }
      case "kv": {
        if (Array.isArray(rec.entries)) {
          const entries: { key: string; value: string }[] = [];
          for (const e of rec.entries) {
            if (!e || typeof e !== "object") continue;
            const er = e as Record<string, unknown>;
            if (typeof er.key !== "string" || typeof er.value !== "string") continue;
            const k = er.key.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 12);
            const v = er.value.trim().slice(0, 200);
            if (k && v) entries.push({ key: k, value: v });
            if (entries.length >= 6) break;
          }
          if (entries.length > 0) out.push({ type: "kv", entries });
        }
        break;
      }
      case "moodboard": {
        if (Array.isArray(rec.refs)) {
          const refs: { url: string; caption?: string }[] = [];
          for (const r of rec.refs) {
            if (!r || typeof r !== "object") continue;
            const rr = r as Record<string, unknown>;
            if (typeof rr.url !== "string") continue;
            const u = rr.url.trim().slice(0, 500);
            if (!/^https?:\/\/[^\s]+$/i.test(u)) continue;
            const c = typeof rr.caption === "string"
              ? rr.caption.trim().slice(0, 80)
              : undefined;
            refs.push(c ? { url: u, caption: c } : { url: u });
            if (refs.length >= 12) break;
          }
          if (refs.length > 0) out.push({ type: "moodboard", refs });
        }
        break;
      }
      case "setlist": {
        if (Array.isArray(rec.items)) {
          const items: { time?: string; title: string }[] = [];
          for (const it of rec.items) {
            if (!it || typeof it !== "object") continue;
            const ir = it as Record<string, unknown>;
            if (typeof ir.title !== "string") continue;
            const t = ir.title.trim().slice(0, 120);
            if (!t) continue;
            const tm = typeof ir.time === "string"
              ? ir.time.trim().slice(0, 10)
              : undefined;
            const okTime = tm && /^\d{1,2}(:\d{2})?$/.test(tm) ? tm : undefined;
            items.push(okTime ? { time: okTime, title: t } : { title: t });
            if (items.length >= 12) break;
          }
          if (items.length > 0) out.push({ type: "setlist", items });
        }
        break;
      }
      case "reflist": {
        if (Array.isArray(rec.items)) {
          const items: { url: string; caption?: string }[] = [];
          for (const it of rec.items) {
            if (!it || typeof it !== "object") continue;
            const ir = it as Record<string, unknown>;
            if (typeof ir.url !== "string") continue;
            const u = ir.url.trim().slice(0, 500);
            if (!/^https?:\/\/[^\s]+$/i.test(u)) continue;
            const c = typeof ir.caption === "string"
              ? ir.caption.trim().slice(0, 120)
              : undefined;
            items.push(c ? { url: u, caption: c } : { url: u });
            if (items.length >= 12) break;
          }
          if (items.length > 0) out.push({ type: "reflist", items });
        }
        break;
      }
    }
    if (out.length >= 1) break; // a thing carries at most ONE module
  }
  return out;
}
