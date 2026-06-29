import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SpaceView } from "./SpaceView";
import { readSpaceForViewer } from "@/lib/server/spaceRead";
import { fetchProjectTheme } from "@/lib/server/profile";
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
const getSpaceAccess = cache(async (id: string) => {
  const { userId } = await auth();
  return readSpaceForViewer(supabaseAdmin(), { spaceId: id, userId }).catch(() => null);
});

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const result = await getSpaceAccess(id);
  if (!result) return { title: "—", robots: { index: false, follow: false } };
  const { space } = result;
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
  const result = await getSpaceAccess(id);
  if (!result) notFound();

  const canEdit = result.space.deletedAt === null
    && (result.role === "owner" || result.role === "editor");
  const themeMode = await fetchProjectTheme(result.space.owner?.id);
  return (
    <SpaceView
      id={id}
      initialSpace={result.space}
      canEditOverride={canEdit ? true : undefined}
      themeMode={themeMode}
    />
  );
}
