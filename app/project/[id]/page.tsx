import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchHandoffWithClient } from "@/lib/db";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { readSpaceForViewer } from "@/lib/server/spaceRead";
import { fetchProjectTheme } from "@/lib/server/profile";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

// The workspace is the live project; never serve it from the data cache.
export const dynamic = "force-dynamic";

/**
 * Project workspace — available to the owner and explicit Team/Kunde project
 * members. StudioWorkspace applies role-aware editing and keeps lifecycle
 * administration owner-only. Full-screen, outside the studio shell.
 */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) notFound();
  const admin = supabaseAdmin();
  const result = await readSpaceForViewer(admin, { spaceId: id, userId }).catch(() => null);
  if (!result) notFound();
  const { space, role: accessRole } = result;
  if (accessRole !== "owner" && accessRole !== "editor" && accessRole !== "client") notFound();

  // Handoff lives behind a separate, migration-tolerant service-role read.
  space.handoff = await fetchHandoffWithClient(admin, space.id);
  const themeMode = await fetchProjectTheme(space.owner?.id);

  return <StudioWorkspace space={space} accessRole={accessRole} themeMode={themeMode} />;
}
