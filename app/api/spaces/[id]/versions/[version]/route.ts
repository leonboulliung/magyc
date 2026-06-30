import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { readVersionForViewer } from "@/lib/server/spaceRead";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version: rawVersion } = await params;
  const version = Number.parseInt(rawVersion, 10);
  if (!Number.isInteger(version) || version < 1 || version > 10_000) {
    return NextResponse.json({ error: "bad_version" }, { status: 400 });
  }
  const { userId } = await auth();
  try {
    const result = await readVersionForViewer(supabaseAdmin(), { spaceId: id, version, userId });
    if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(
      { modules: result.modules },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[space-read] version failed:", (error as Error).message);
    return NextResponse.json({ error: "version_read_failed" }, { status: 500 });
  }
}
