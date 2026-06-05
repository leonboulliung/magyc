import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchCardById } from "@/lib/db";
import { PostDetail } from "./PostDetail";

// Per-card SEO + social metadata. Runs on the server so crawlers and
// link-unfurlers (WhatsApp, Slack, iMessage, Twitter…) see real titles
// and descriptions. No generated image — text metadata from existing data.
export async function generateMetadata(
  { params }: { params: { id: string } },
): Promise<Metadata> {
  const card = await fetchCardById(params.id).catch(() => null);

  if (!card) {
    return {
      title: "Not found · Creator",
      robots: { index: false, follow: false },
    };
  }

  const where = card.location?.label;
  const tagLine = card.tags?.length ? ` · ${card.tags.map((t) => `#${t}`).join(" ")}` : "";

  // Per-item OG is the cold-start recruiter: each card is a self-contained
  // landing page that sells itself. Copy invites joining.
  const joinedCount = card.members.filter((m) => m.state === "joined").length;
  const fallback = `${where ? `In ${where}. ` : ""}${joinedCount}/${card.spots ?? "—"} people in. Join on Creator.`;
  const description = (card.description?.trim() || fallback).slice(0, 200) + tagLine;

  const title = `${card.title}${where ? ` · ${where}` : ""} · Creator`;
  const url = `/post/${card.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: card.title,
      description,
      url,
      siteName: "Creator",
    },
    twitter: {
      card: "summary",
      title: card.title,
      description,
    },
  };
}

export default function PostPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-paper" />}>
      <PostDetail id={params.id} />
    </Suspense>
  );
}
