import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ContractView } from "./ContractView";
import { readSpaceForViewer } from "@/lib/server/spaceRead";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

// The contract is mutable + access-gated; never serve from the data cache.
export const dynamic = "force-dynamic";

/**
 * Absegnung — the dedicated contract environment for a project. A deliberately
 * separate surface from the planning dot-grid (document-like, with a "← Zur
 * Planung" reference). Owner always; a client only when the space is shared.
 */
export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  const result = await readSpaceForViewer(supabaseAdmin(), { spaceId: id, userId }).catch(() => null);
  if (!result) notFound();
  const { space } = result;

  return <ContractView id={space.id} spaceTitle={space.title || ""} />;
}
