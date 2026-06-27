import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { newId } from "@/lib/id";
import { parseBody } from "@/lib/api/validate";
import { getProjectAccess } from "@/lib/server/projectAccess";

/**
 * GET/POST /api/spaces/[id]/messages — the persistent project thread.
 *
 * Two channels: 'magyc' (the assistant Q&A) and 'team' (participant chat).
 * Access mirrors the rest of the project: the owner always; anyone else only
 * when the space is shared. Reads/writes go through the service role.
 *
 * Migration-tolerant: the project_messages table arrives in migration 017, so
 * every DB touch is wrapped — before the migration the chat simply behaves as
 * before (ephemeral), and nothing else breaks.
 */
const CHANNELS = new Set(["magyc", "team"]);

async function gateSpace(id: string) {
  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id, shared")
    .eq("id", id)
    .maybeSingle();
  if (!space) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  const { userId } = await auth();
  const role = await getProjectAccess(admin, {
    spaceId: id,
    ownerId: space.owner_id,
    shared: space.shared,
    userId,
  });
  if (role === "none") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { admin, userId: userId ?? null };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await gateSpace(id);
  if (gate.error) return gate.error;
  const { admin } = gate;

  const channel = new URL(req.url).searchParams.get("channel");
  try {
    let q = admin
      .from("project_messages")
      .select("id, channel, role, author_id, author_name, content, created_at")
      .eq("space_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (channel && CHANNELS.has(channel)) q = q.eq("channel", channel);
    const { data, error } = await q;
    if (error) return NextResponse.json({ messages: [] }); // table not present yet
    return NextResponse.json({ messages: data ?? [] });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await gateSpace(id);
  if (gate.error) return gate.error;
  const { admin, userId } = gate;

  const parsed = await parseBody(req, z.object({
    channel: z.string(),
    content: z.string().min(1).max(2000),
    role: z.string().optional(),
    anonToken: z.string().optional(),
    authorName: z.string().max(120).optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;
  if (!CHANNELS.has(b.channel)) return NextResponse.json({ error: "bad_channel" }, { status: 400 });

  const row = {
    id: newId(),
    space_id: id,
    channel: b.channel,
    role: b.role === "assistant" ? "assistant" : "user",
    author_id: userId || b.anonToken || null,
    author_name: b.authorName?.trim().slice(0, 120) || (b.role === "assistant" ? "@magyc" : null),
    content: b.content.trim().slice(0, 2000),
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await admin.from("project_messages").insert(row);
    if (error) return NextResponse.json({ ok: true, persisted: false, message: row });
  } catch {
    return NextResponse.json({ ok: true, persisted: false, message: row });
  }
  return NextResponse.json({ ok: true, persisted: true, message: row });
}
