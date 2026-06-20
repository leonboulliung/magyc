import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchSpaceById } from "@/lib/db";
import { ContractView } from "./ContractView";

// The contract is mutable + access-gated; never serve from the data cache.
export const dynamic = "force-dynamic";

/**
 * Absegnung — the dedicated contract environment for a project. A deliberately
 * separate surface from the planning dot-grid (document-like, with a "← Zur
 * Planung" reference). Owner always; a client only when the space is shared.
 */
export default async function ContractPage({ params }: { params: { id: string } }) {
  const space = await fetchSpaceById(params.id).catch(() => null);
  if (!space) notFound();

  const { userId } = await auth();
  const isOwner = !!userId && space.owner?.id === userId;
  if (!isOwner && !space.shared) notFound();

  return <ContractView id={space.id} spaceTitle={space.title || ""} />;
}
