import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchSpaceById } from "@/lib/db";
import { SpaceView } from "@/app/s/[id]/SpaceView";
import { StudioProjectBar } from "@/components/studio/StudioProjectBar";

// The workspace is the live project; never serve it from the data cache.
export const dynamic = "force-dynamic";

/**
 * Project workspace — the same SpaceView as a public space, but
 * owner-gated (only the Clerk owner sees their private suite project) and
 * with a Studio project bar (back + stage stepper) layered on top. This
 * route is OUTSIDE the (shell) group, so SpaceView gets the full screen.
 */
export default async function StudioProjectPage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  const space = await fetchSpaceById(params.id).catch(() => null);

  // Owner-only: a suite project is a private draft owned by a Clerk user.
  if (!space || !userId || space.owner?.id !== userId) notFound();

  return (
    <>
      <StudioProjectBar id={space.id} stage={space.stage} segment={space.segment} />
      <SpaceView id={space.id} initialSpace={space} />
    </>
  );
}
