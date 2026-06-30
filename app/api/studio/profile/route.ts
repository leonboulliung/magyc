import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { ensureProfile } from "@/lib/server/profile";
import { parseBody } from "@/lib/api/validate";
import { cleanProfile, cleanSettings } from "@/lib/studioProfile";

/**
 * GET/PUT /api/studio/profile — the signed-in photographer's account profile
 * + settings, persisted on their `profiles` row (migration 014).
 */

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureProfile(userId);
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("display_name, avatar_url, color, headline, bio, specialties, settings")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[studio-profile] fetch failed:", error.message);
    return NextResponse.json({ error: "profile_failed" }, { status: 500 });
  }

  const profile = cleanProfile({
    displayName: data?.display_name ?? "",
    headline: data?.headline ?? "",
    bio: data?.bio ?? "",
    specialties: data?.specialties ?? [],
    settings: data?.settings ?? {},
    avatarUrl: data?.avatar_url ?? null,
    color: data?.color ?? null,
  });
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, z.object({
    displayName: z.string().max(80).optional(),
    headline: z.string().max(120).optional(),
    bio: z.string().max(600).optional(),
    avatarUrl: z.string().url().max(1000).nullable().optional(),
    specialties: z.array(z.string()).max(24).optional(),
    settings: z.unknown().optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  await ensureProfile(userId);
  const admin = supabaseAdmin();

  const update: Record<string, unknown> = {};
  if (typeof body.displayName === "string") update.display_name = body.displayName.trim().slice(0, 80);
  if (typeof body.headline === "string") update.headline = body.headline.trim().slice(0, 120);
  if (typeof body.bio === "string") update.bio = body.bio.slice(0, 600);
  if (body.avatarUrl === null || typeof body.avatarUrl === "string") update.avatar_url = body.avatarUrl;
  if (Array.isArray(body.specialties)) {
    update.specialties = body.specialties.map((s) => s.trim()).filter(Boolean).slice(0, 24);
  }
  if (body.settings !== undefined) update.settings = cleanSettings(body.settings);

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { data: updated, error } = await admin
    .from("profiles")
    .update(update)
    .eq("id", userId)
    .select("id");
  if (error) {
    console.error("[studio-profile] update failed:", error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    console.error("[studio-profile] update matched no rows:", userId);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
