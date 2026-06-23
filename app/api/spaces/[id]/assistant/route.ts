import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamText, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeModule } from "@/lib/modules";
import { recordAiEvent } from "@/lib/server/aiEvents";
import { parseBody } from "@/lib/api/validate";
import type { Module, ModuleType } from "@/lib/types";

/**
 * POST /api/spaces/[id]/assistant — the project's always-on agent (@magyc).
 *
 * Streams its reply (Vercel AI SDK) and can ACT: when the requester is the
 * owner of a still-open project, it may add elements via the `addElement` tool.
 * It always receives the full project state — lifecycle stage included — so it
 * knows e.g. that a closed project cannot be changed, and it answers in plain
 * language (never raw JSON / field schemas).
 */
const MAX_QUESTION_CHARS = 1200;
const MAX_HISTORY_ITEMS = 8;

const lastCallAt = new Map<string, number>();

// Element types the agent may add: those that render fine empty AND survive
// `sanitizeModules` on read (so the added element doesn't vanish on reload).
const ADDABLE: Partial<Record<ModuleType, () => Module>> = {
  images: () => ({ type: "images", microTitle: "Bilder" }),
  moodboard: () => ({ type: "moodboard", microTitle: "Moodboard", directions: [] }),
  attachments: () => ({ type: "attachments", microTitle: "Dateien" }),
  notes: () => ({ type: "notes", microTitle: "Notizen" }),
  qa: () => ({ type: "qa", microTitle: "Fragen" }),
  checklist: () => ({ type: "checklist", microTitle: "Checkliste", items: [] }),
  sketch: () => ({ type: "sketch", microTitle: "Skizze" }),
  audio: () => ({ type: "audio", microTitle: "Audio" }),
  selection: () => ({ type: "selection", microTitle: "Auswahl" }),
};
const ADDABLE_LABELS: Record<string, string> = {
  images: "Bilder", moodboard: "Moodboard", attachments: "Dateien", notes: "Notizen",
  qa: "Fragen", checklist: "Checkliste", sketch: "Skizze", audio: "Audio", selection: "Auswahl",
};

function moduleLine(m: unknown, i: number): string {
  if (!m || typeof m !== "object") return `${i + 1}. (leer)`;
  const d = m as Record<string, unknown>;
  const type = typeof d.type === "string" ? d.type : "?";
  const title = typeof d.microTitle === "string" && d.microTitle ? ` „${d.microTitle}“` : "";
  return `${i + 1}. ${type}${title}`;
}

function buildSystem(space: {
  title: string | null; input_text: string | null; language: string | null; modules: unknown[] | null;
}, opts: { canEdit: boolean; locked: boolean; isOwner: boolean; stage: string | null }): string {
  const lang = space.language || "de";
  const modules = Array.isArray(space.modules) ? space.modules : [];
  const elementList = modules.length ? modules.map(moduleLine).join("\n") : "(noch keine Elemente)";
  const status = opts.stage === "handoff"
    ? "ABGESCHLOSSEN — das Projekt ist fertig. Strukturelle Änderungen sind NICHT möglich."
    : opts.stage === "production"
      ? "IN AUSWAHL — der Plan ist gesperrt. Strukturelle Änderungen sind NICHT möglich."
      : "IN PLANUNG — der Plan ist offen.";
  const capability = opts.canEdit
    ? "Du kannst Elemente hinzufügen, entfernen und umbenennen: nutze die Tools nur, wenn der Nutzer eine konkrete Änderung will, und bestätige danach kurz in Worten."
    : opts.locked
      ? "Du kannst die Projektseite NICHT ändern (Projekt gesperrt/abgeschlossen). Hilf nur mit Erklärungen, Vorschlägen oder Diskussion — und sag offen, dass Änderungen nicht mehr möglich sind."
      : "Du kannst die Projektseite gerade nicht ändern (nur die Inhaber:in kann das). Hilf mit Vorschlägen.";

  return `Du bist @magyc, der durchgehende Projekt-Agent dieses einen Projekts.
Antworte in der Projektsprache (${lang}), knapp, konkret und ruhig.

WICHTIG:
- Gib NIEMALS JSON, Code, Feld-Schemas oder interne Strukturen aus. Sprich in normaler Sprache.
- Behaupte nie, etwas geändert zu haben, das du nicht über ein Tool wirklich getan hast.
- ${capability}

PROJEKT
Titel: ${space.title || "—"}
Briefing: ${(space.input_text || "").slice(0, 800)}
Status: ${status}

ELEMENTE (Reihenfolge auf der Seite):
${elementList}`;
}

async function persistModulesWithRev(
  admin: ReturnType<typeof supabaseAdmin>,
  spaceId: string,
  modules: unknown[],
  expectedRev: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await admin
    .from("spaces")
    .update({ modules, modules_rev: expectedRev + 1 })
    .eq("id", spaceId)
    .eq("modules_rev", expectedRev)
    .select("id");
  if (error) return { ok: false, message: "Konnte nicht gespeichert werden." };
  if (!data || data.length === 0) return { ok: false, message: "Das Projekt wurde gerade woanders geändert. Bitte aktualisiere kurz." };
  return { ok: true };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  const parsed = await parseBody(req, z.object({
    question: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
    anonToken: z.string().trim().max(128).optional().nullable(),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(1400),
    })).max(MAX_HISTORY_ITEMS).optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const actorKey = userId || body.anonToken || req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  if (now - (lastCallAt.get(actorKey) || 0) < 3500) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  lastCallAt.set(actorKey, now);

  const admin = supabaseAdmin();
  const { data: space, error } = await admin
    .from("spaces")
    .select("id, title, input_text, language, modules, modules_rev, stage, shared, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isOwner = !!userId && space.owner_id === userId;
  if (space.stage && !space.shared && !isOwner) {
    return NextResponse.json({ error: "not_shared" }, { status: 403 });
  }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const locked = space.stage === "production" || space.stage === "handoff";
  const canEdit = isOwner && !locked;

  // The acting tool — only present for an owner on an open project, so the
  // agent literally cannot offer to change a closed/foreign project.
  const tools = canEdit
    ? {
        addElement: tool({
          description: "Fügt der Projektseite ein neues, leeres Element des angegebenen Typs hinzu (der Nutzer füllt es danach).",
          inputSchema: z.object({
            type: z.enum(Object.keys(ADDABLE) as [string, ...string[]]).describe("Element-Typ"),
          }),
          execute: async ({ type }) => {
            const make = ADDABLE[type as ModuleType];
            const widget = make ? sanitizeModule(make()) : null;
            if (!widget) return { ok: false, message: `Typ ${type} kann nicht hinzugefügt werden.` };
            const { data: cur } = await admin.from("spaces").select("modules, modules_rev").eq("id", params.id).maybeSingle();
            const mods = Array.isArray(cur?.modules) ? (cur!.modules as unknown[]) : [];
            const rev = typeof cur?.modules_rev === "number" ? cur.modules_rev : 0;
            const saved = await persistModulesWithRev(admin, params.id, [...mods, widget], rev);
            if (!saved.ok) return saved;
            return { ok: true, message: `Element „${ADDABLE_LABELS[type] ?? type}“ wurde hinzugefügt.` };
          },
        }),
        removeElement: tool({
          description: "Entfernt ein Element anhand seiner sichtbaren Nummer aus der Elementliste. Nicht fuer Kopfbereich/Projekt-Titel verwenden.",
          inputSchema: z.object({
            elementNumber: z.number().int().min(1).max(80).describe("1-basierte Nummer aus der Elementliste"),
          }),
          execute: async ({ elementNumber }) => {
            const index = elementNumber - 1;
            const { data: cur } = await admin.from("spaces").select("modules, modules_rev").eq("id", params.id).maybeSingle();
            const mods = Array.isArray(cur?.modules) ? (cur!.modules as unknown[]) : [];
            const rev = typeof cur?.modules_rev === "number" ? cur.modules_rev : 0;
            if (index < 0 || index >= mods.length) return { ok: false, message: "Dieses Element gibt es nicht." };
            const current = mods[index] as { type?: unknown };
            if (current?.type === "heading" || current?.type === "rich_text" || current?.type === "tags") {
              return { ok: false, message: "Kopfbereich, Beschreibung und Tags entferne ich nicht automatisch." };
            }
            const saved = await persistModulesWithRev(admin, params.id, mods.filter((_, i) => i !== index), rev);
            if (!saved.ok) return saved;
            await admin.from("module_state").delete().eq("space_id", params.id).eq("module_index", index);
            for (let k = index + 1; k < mods.length; k++) {
              await admin.from("module_state").update({ module_index: k - 1 }).eq("space_id", params.id).eq("module_index", k);
            }
            return { ok: true, message: `Element ${elementNumber} wurde entfernt.` };
          },
        }),
        renameElement: tool({
          description: "Benennt ein Element um, indem der kleine Elementtitel (microTitle) gesetzt wird.",
          inputSchema: z.object({
            elementNumber: z.number().int().min(1).max(80).describe("1-basierte Nummer aus der Elementliste"),
            title: z.string().trim().min(1).max(80).describe("Neuer kurzer Elementtitel"),
          }),
          execute: async ({ elementNumber, title }) => {
            const index = elementNumber - 1;
            const { data: cur } = await admin.from("spaces").select("modules, modules_rev").eq("id", params.id).maybeSingle();
            const mods = Array.isArray(cur?.modules) ? (cur!.modules as unknown[]) : [];
            const rev = typeof cur?.modules_rev === "number" ? cur.modules_rev : 0;
            if (index < 0 || index >= mods.length) return { ok: false, message: "Dieses Element gibt es nicht." };
            const current = mods[index];
            if (!current || typeof current !== "object") return { ok: false, message: "Dieses Element kann ich nicht umbenennen." };
            const next = [...mods];
            next[index] = { ...(current as Record<string, unknown>), microTitle: title };
            const saved = await persistModulesWithRev(admin, params.id, next, rev);
            if (!saved.ok) return saved;
            return { ok: true, message: `Element ${elementNumber} heißt jetzt „${title}“.` };
          },
        }),
      }
    : undefined;

  const started = Date.now();
  const result = streamText({
    model: openai("gpt-4o-mini"),
    temperature: 0.4,
    system: buildSystem(space as Parameters<typeof buildSystem>[0], { canEdit, locked, isOwner, stage: space.stage }),
    messages: [
      ...(body.history || []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: body.question },
    ],
    tools,
    stopWhen: stepCountIs(4),
    onFinish: ({ text, usage }) => {
      void recordAiEvent({
        userId, anonId: body.anonToken || null, spaceId: params.id,
        eventType: "assistant_chat", model: "gpt-4o-mini",
        input: { question: body.question }, output: text,
        metadata: { canEdit, stage: space.stage ?? null },
        latencyMs: Date.now() - started,
        tokensIn: usage?.inputTokens ?? null, tokensOut: usage?.outputTokens ?? null,
      });
    },
  });

  return result.toTextStreamResponse();
}
