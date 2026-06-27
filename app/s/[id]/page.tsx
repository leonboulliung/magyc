import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchSpaceById } from "@/lib/db";
import { SpaceView } from "./SpaceView";
import { getProjectAccess } from "@/lib/server/projectAccess";
import { supabaseAdmin } from "@/lib/supabase";

// Spaces are mutable: without this, Next.js may serve the Supabase fetch from
// its Data Cache and edits look lost after a reload (PUT 200, DB updated,
// stale page). Always render from live data.
export const dynamic = "force-dynamic";

/**
 * Request-level dedupe: generateMetadata and the page both need the
 * space, but it should only be fetched ONCE per request. React's cache()
 * memoizes the call across the metadata + render passes.
 */
const getSpace = cache((id: string) => fetchSpaceById(id).catch(() => null));

async function blocksPrivateSuiteLink(space: Awaited<ReturnType<typeof getSpace>>) {
  if (!space || space.stage === null || space.shared) return false;
  const { userId } = await auth();
  if (!userId) return true;
  const role = await getProjectAccess(supabaseAdmin(), {
    spaceId: space.id,
    ownerId: space.owner?.id ?? null,
    userId,
  });
  return role === "none";
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const space = await getSpace(id);
  if (!space) return { title: "—", robots: { index: false, follow: false } };
  if (await blocksPrivateSuiteLink(space)) {
    return { title: "—", robots: { index: false, follow: false } };
  }
  return {
    title: space.title || "MAGYC",
    description: space.inputText.slice(0, 200),
    openGraph: {
      type: "article",
      title: space.title || "MAGYC",
      description: space.inputText.slice(0, 200),
      url: `/s/${space.id}`,
      siteName: "MAGYC",
    },
  };
}

/**
 * The space is fetched on the SERVER and handed to the client view as
 * initial data — so the content is in the HTML on first paint, with no
 * client-side fetch waterfall. SpaceView then takes over for realtime +
 * optimistic edits.
 */
export default async function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const space = await getSpace(id);

  // Suite projects are private until shared: a non-owner opening an
  // unshared project's link gets a 404. Anonymous/published spaces
  // (stage === null) are unaffected and stay public-by-id.
  if (await blocksPrivateSuiteLink(space)) notFound();

  return <SpaceView id={id} initialSpace={space} />;
}
