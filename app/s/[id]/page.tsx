import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchSpaceById } from "@/lib/db";
import { SpaceView } from "./SpaceView";

export async function generateMetadata(
  { params }: { params: { id: string } },
): Promise<Metadata> {
  const space = await fetchSpaceById(params.id).catch(() => null);
  if (!space) return { title: "—", robots: { index: false, follow: false } };
  return {
    title: space.title || "Creator",
    description: space.inputText.slice(0, 200),
    openGraph: {
      type: "article",
      title: space.title || "Creator",
      description: space.inputText.slice(0, 200),
      url: `/s/${space.id}`,
      siteName: "Creator",
    },
  };
}

export default function SpacePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SpaceView id={params.id} />
    </Suspense>
  );
}
