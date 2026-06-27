import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchSpaceById } from "@/lib/db";
import { ContractView } from "./ContractView";
import { getProjectAccess } from "@/lib/server/projectAccess";
import { supabaseAdmin } from "@/lib/supabase";

// The contract is mutable + access-gated; never serve from the data cache.
export const dynamic = "force-dynamic";

/**
 * Absegnung — the dedicated contract environment for a project. A deliberately
 * separate surface from the planning dot-grid (document-like, with a "← Zur
 * Planung" reference). Owner always; a client only when the space is shared.
 */
export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const space = await fetchSpaceById(id).catch(() => null);
  if (!space) notFound();

  const { userId } = await auth();
  const accessRole = await getProjectAccess(supabaseAdmin(), {
    spaceId: space.id,
    ownerId: space.owner?.id ?? null,
    shared: space.shared,
    userId,
  });
  if (accessRole === "none") notFound();

  return <ContractView id={space.id} spaceTitle={space.title || ""} />;
}
