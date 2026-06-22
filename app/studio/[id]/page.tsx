import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchSpaceById } from "@/lib/db";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";

// The workspace is the live project; never serve it from the data cache.
export const dynamic = "force-dynamic";

/**
 * Project workspace — owner-gated (only the Clerk owner sees their private
 * suite project). StudioWorkspace lays the forward-only stage bar over the
 * surface for the current view: the project page (Planung) or the embedded
 * contract (Absegnung/Abschluss). This route is OUTSIDE the (shell) group, so
 * the surface gets the full screen.
 */
export default async function StudioProjectPage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  const space = await fetchSpaceById(params.id).catch(() => null);

  // Owner-only: a suite project is a private draft owned by a Clerk user.
  if (!space || !userId || space.owner?.id !== userId) notFound();

  return <StudioWorkspace space={space} />;
}
