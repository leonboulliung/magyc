import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchSpaceById, fetchHandoff } from "@/lib/db";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { claimPendingProjectMemberships, getProjectAccess } from "@/lib/server/projectAccess";
import { supabaseAdmin } from "@/lib/supabase";

// The workspace is the live project; never serve it from the data cache.
export const dynamic = "force-dynamic";

/**
 * Project workspace — available to the owner and explicit Team/Kunde project
 * members. StudioWorkspace applies role-aware editing and keeps lifecycle
 * administration owner-only. This route is OUTSIDE the (shell) group, so the
 * surface gets the full screen.
 */
export default async function StudioProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  const space = await fetchSpaceById(id).catch(() => null);
  if (!space || !userId) notFound();
  const admin = supabaseAdmin();
  await claimPendingProjectMemberships(admin, userId);
  const accessRole = await getProjectAccess(admin, {
    spaceId: space.id,
    ownerId: space.owner?.id ?? null,
    shared: space.shared,
    userId,
  });
  if (accessRole !== "owner" && accessRole !== "editor" && accessRole !== "client") notFound();

  // handoff lives behind a separate, migration-tolerant read (see fetchHandoff).
  space.handoff = await fetchHandoff(space.id);

  return <StudioWorkspace space={space} accessRole={accessRole} />;
}
