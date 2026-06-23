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
      ? "IN ABSEGNUNG — der Plan ist gesperrt. Strukturelle Änderungen sind NICHT möglich."
      : "IN PLANUNG — der Plan ist offen.";
  const capability = opts.canEdit
    ? "Du kannst Elemente hinzufügen: nutze das Tool `addElement` und bestätige danach kurz in Worten."
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
    .select("id, title, input_text, language, modules, stage, shared, owner_id")
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
            const { data: cur } = await admin.from("spaces").select("modules").eq("id", params.id).maybeSingle();
            const mods = Array.isArray(cur?.modules) ? (cur!.modules as unknown[]) : [];
            const { error: upErr } = await admin.from("spaces").update({ modules: [...mods, widget] }).eq("id", params.id).select("id");
            if (upErr) return { ok: false, message: "Konnte nicht gespeichert werden." };
            return { ok: true, message: `Element „${ADDABLE_LABELS[type] ?? type}“ wurde hinzugefügt.` };
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
