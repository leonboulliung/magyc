import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { readSpaceForViewer } from "@/lib/server/spaceRead";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId } = await auth();
  try {
    const result = await readSpaceForViewer(supabaseAdmin(), { spaceId: id, userId });
    if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(
      { space: result.space, accessRole: result.role },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[space-read] snapshot failed:", (error as Error).message);
    return NextResponse.json({ error: "space_read_failed" }, { status: 500 });
  }
}
