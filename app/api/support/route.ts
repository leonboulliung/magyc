import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { SUPPORT_TYPES } from "@/lib/adminAccount";
import { parseBody } from "@/lib/api/validate";
import { newId } from "@/lib/id";
import { recordAppEvent } from "@/lib/server/observability";
import { ensureProfile } from "@/lib/server/profile";
import { supabaseAdmin } from "@/lib/supabase";

const bodySchema = z.object({
  type: z.enum(SUPPORT_TYPES).default("problem"),
  message: z.string().trim().min(10).max(4000),
  route: z.string().max(500).optional(),
  spaceId: z.string().max(80).optional(),
  lastError: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  await ensureProfile(userId);

  let email: string | null = null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email =
      user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress ||
      user.emailAddresses[0]?.emailAddress ||
      null;
  } catch {
    email = null;
  }

  const admin = supabaseAdmin();
  const id = newId();
  const { error } = await admin.from("support_tickets").insert({
    id,
    user_id: userId,
    email,
    type: parsed.data.type,
    status: "new",
    message: parsed.data.message,
    route: parsed.data.route || null,
    space_id: parsed.data.spaceId || null,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
    last_error: parsed.data.lastError || null,
    metadata: JSON.parse(JSON.stringify(parsed.data.metadata || {})),
  });

  if (error) {
    console.error("[support] insert failed:", error.message);
    await recordAppEvent({
      eventType: "support.ticket.failed",
      status: "error",
      route: "/api/support",
      method: "POST",
      userId,
      actorKind: "user",
      actorId: userId,
      spaceId: parsed.data.spaceId || null,
      error,
    });
    return NextResponse.json({ error: "support_failed" }, { status: 500 });
  }

  await recordAppEvent({
    eventType: "support.ticket.created",
    status: "ok",
    route: "/api/support",
    method: "POST",
    userId,
    actorKind: "user",
    actorId: userId,
    spaceId: parsed.data.spaceId || null,
    metadata: { ticketId: id, type: parsed.data.type },
  });

  return NextResponse.json({ ok: true, id });
}
