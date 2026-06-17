import OpenAI from "openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAiEvent } from "@/lib/server/aiEvents";
import { parseBody } from "@/lib/api/validate";

const MAX_QUESTION_CHARS = 1200;
const MAX_HISTORY_ITEMS = 8;
const MAX_CONTEXT_CHARS = 7000;

const lastCallAt = new Map<string, number>();

type ChatRole = "user" | "assistant";

function clip(text: string, max: number) {
  return text.trim().slice(0, max);
}

function moduleSummary(module: unknown, index: number): string {
  if (!module || typeof module !== "object") return `${index + 1}. unknown`;
  const data = module as Record<string, unknown>;
  const type = typeof data.type === "string" ? data.type : "unknown";
  const title = typeof data.microTitle === "string" ? data.microTitle : "";
  const description = typeof data.description === "string" ? data.description : "";

  const useful: Record<string, unknown> = {};
  for (const key of [
    "text",
    "tags",
    "question",
    "options",
    "items",
    "roles",
    "packages",
    "columns",
    "rows",
    "phases",
    "from",
    "to",
    "unit",
    "topic",
    "label",
  ]) {
    if (key in data) useful[key] = data[key];
  }

  const body = JSON.stringify(useful).replace(/\s+/g, " ");
  return clip(`${index + 1}. ${type}${title ? ` - ${title}` : ""}${description ? ` - ${description}` : ""}${body !== "{}" ? ` - ${body}` : ""}`, 900);
}

function buildContext(space: {
  title: string | null;
  input_text: string | null;
  language: string | null;
  modules: unknown[] | null;
}) {
  const modules = Array.isArray(space.modules) ? space.modules : [];
  return clip(`PROJECT TITLE:
${space.title || "Untitled"}

ORIGINAL USER INPUT:
${space.input_text || ""}

LANGUAGE:
${space.language || "en"}

CURRENT PAGE ELEMENTS:
${modules.map(moduleSummary).join("\n")}`, MAX_CONTEXT_CHARS);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
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
  const prev = lastCallAt.get(actorKey) || 0;
  if (now - prev < 3500) {
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
  // Private suite project: once sharing is off, the assistant must not
  // expose project context or trigger OpenAI spend for a stale link.
  if (space.stage && !space.shared && (!userId || space.owner_id !== userId)) {
    return NextResponse.json({ error: "not_shared" }, { status: 403 });
  }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const started = Date.now();
  const context = buildContext(space as {
    title: string | null;
    input_text: string | null;
    language: string | null;
    modules: unknown[] | null;
  });
  const history = (body.history || []).map((item) => ({
    role: item.role as ChatRole,
    content: item.content,
  }));

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 1,
      timeout: 15_000,
    });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.45,
      messages: [
        {
          role: "system",
          content: `You are MAGYC's always-available project assistant.
Help collaborators make this project real. Use the page context. Be concrete,
brief, and calm. If the user asks for changes, propose exactly what should
change, but do not claim you already changed the page. Answer in the project
language unless the user clearly writes another language.`,
        },
        { role: "user", content: context },
        ...history,
        { role: "user", content: body.question },
      ],
    });
    const answer = completion.choices[0]?.message?.content?.trim() || "";
    if (!answer) throw new Error("assistant_empty");

    await recordAiEvent({
      userId,
      anonId: body.anonToken || null,
      spaceId: params.id,
      eventType: "assistant_chat",
      model: "gpt-4o-mini",
      input: { question: body.question, history },
      output: answer,
      metadata: {
        title: space.title ?? null,
        moduleCount: Array.isArray(space.modules) ? space.modules.length : 0,
      },
      latencyMs: Date.now() - started,
      tokensIn: completion.usage?.prompt_tokens ?? null,
      tokensOut: completion.usage?.completion_tokens ?? null,
    });

    return NextResponse.json({ ok: true, answer });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    await recordAiEvent({
      userId,
      anonId: body.anonToken || null,
      spaceId: params.id,
      eventType: "assistant_chat",
      model: "gpt-4o-mini",
      status: "error",
      input: { question: body.question, history },
      error: msg,
      latencyMs: Date.now() - started,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
