import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchSpaceById } from "@/lib/db";
import { SpaceView } from "./SpaceView";

// Spaces are mutable: without this, Next 14 serves the supabase fetch from
// its Data Cache and edits look lost after a reload (PUT 200, DB updated,
// stale page). Always render from live data.
export const dynamic = "force-dynamic";

/**
 * Request-level dedupe: generateMetadata and the page both need the
 * space, but it should only be fetched ONCE per request. React's cache()
 * memoizes the call across the metadata + render passes.
 */
const getSpace = cache((id: string) => fetchSpaceById(id).catch(() => null));

export async function generateMetadata(
  { params }: { params: { id: string } },
): Promise<Metadata> {
  const space = await getSpace(params.id);
  if (!space) return { title: "—", robots: { index: false, follow: false } };
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
export default async function SpacePage({ params }: { params: { id: string } }) {
  const space = await getSpace(params.id);

  // Suite projects are private until shared: a non-owner opening an
  // unshared project's link gets a 404. Anonymous/published spaces
  // (stage === null) are unaffected and stay public-by-id.
  if (space && space.stage !== null && !space.shared) {
    const { userId } = await auth();
    if (!userId || space.owner?.id !== userId) notFound();
  }

  return <SpaceView id={params.id} initialSpace={space} />;
}
