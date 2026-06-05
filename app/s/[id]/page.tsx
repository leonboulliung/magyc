import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchSpaceById } from "@/lib/db";
import { SpaceView } from "./SpaceView";

// Per-space metadata so the URL unfurls nicely when shared (WhatsApp,
// iMessage, Slack, Mastodon, etc.). The unfurled card is the cold-start
// recruiter — it has to sell itself in one line.
export async function generateMetadata(
  { params }: { params: { id: string } },
): Promise<Metadata> {
  const space = await fetchSpaceById(params.id).catch(() => null);
  if (!space) {
    return { title: "Nicht gefunden · Creator", robots: { index: false, follow: false } };
  }
  const brief =
    space.primitives.find((p) => p.type === "brief") as { type: "brief"; text: string } | undefined;
  const desc =
    brief?.text || space.inputText.slice(0, 200);
  return {
    title: `${space.title || "Eine Umgebung"} · Creator`,
    description: desc,
    openGraph: {
      type: "article",
      title: space.title || "Eine Umgebung",
      description: desc,
      url: `/s/${space.id}`,
      siteName: "Creator",
    },
    twitter: {
      card: "summary",
      title: space.title || "Eine Umgebung",
      description: desc,
    },
  };
}

export default function SpacePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <SpaceView id={params.id} />
    </Suspense>
  );
}
