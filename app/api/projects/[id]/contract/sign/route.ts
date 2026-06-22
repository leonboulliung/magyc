import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { parseBody } from "@/lib/api/validate";

/**
 * POST /api/projects/[id]/contract/sign — record a click-consent signature
 * (SES). The role is derived from the requester: the space owner signs as
 * "photographer", anyone else (with the share link, space shared) as "client".
 * Captures name + server timestamp + IP + user-agent into signers[] + audit.
 * When BOTH parties have signed, the contract is locked (immutable).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = await parseBody(req, z.object({
    name: z.string().min(1).max(120),
    // Optional drawn-signature mode (photographer can opt in): a place + an
    // image data URL of the hand-drawn signature. Date is the server timestamp.
    place: z.string().max(160).optional(),
    signature: z.string().max(200_000).optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const name = parsed.data.name.trim().slice(0, 120);
  const place = parsed.data.place?.trim().slice(0, 160) || "";
  const signature = typeof parsed.data.signature === "string" && parsed.data.signature.startsWith("data:image/")
    ? parsed.data.signature.slice(0, 200_000)
    : "";

  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id, shared")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { userId } = await auth();
  const isOwner = !!userId && userId === space.owner_id;
  if (!isOwner && !space.shared) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const role: "photographer" | "client" = isOwner ? "photographer" : "client";

  const { data: contract } = await admin
    .from("project_contracts")
    .select("status, locked, signers, audit, content_hash, owner_signed_at, client_signed_at")
    .eq("space_id", params.id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "no_contract" }, { status: 409 });
  if (contract.locked) return NextResponse.json({ error: "locked" }, { status: 409 });
  // Signing only opens once the owner has released the prepared contract.
  // "sent"/"draft" mean still in preparation; everything past that is signable.
  const signable = new Set(["released", "owner_signed", "client_signed"]);
  if (!signable.has(contract.status)) {
    return NextResponse.json({ error: "not_released" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ua = req.headers.get("user-agent")?.slice(0, 300) || "";

  const signers = Array.isArray(contract.signers) ? contract.signers : [];
  const audit = Array.isArray(contract.audit) ? contract.audit : [];
  // One signature per role — replace an earlier one from the same role.
  const nextSigners = [
    ...signers.filter((s: { role?: string }) => s?.role !== role),
    { role, name, place, signature, ip, ua, signedAt: now, contentHash: contract.content_hash ?? null },
  ];
  audit.push({ event: `${role}_signed`, role, name, place, mode: signature ? "drawn" : "click", ts: now, ip, ua, contentHash: contract.content_hash ?? null });

  const ownerSignedAt = role === "photographer" ? now : contract.owner_signed_at;
  const clientSignedAt = role === "client" ? now : contract.client_signed_at;
  const bothSigned = !!ownerSignedAt && !!clientSignedAt;

  const update: Record<string, unknown> = {
    signers: nextSigners,
    audit,
    owner_signed_at: ownerSignedAt,
    client_signed_at: clientSignedAt,
    status: bothSigned ? "signed" : (role === "photographer" ? "owner_signed" : "client_signed"),
    updated_at: now,
  };
  if (bothSigned) {
    update.signed_at = now;
    update.locked = true;
    audit.push({ event: "locked", ts: now });
    update.audit = audit;
  }

  const { error } = await admin.from("project_contracts").update(update).eq("space_id", params.id);
  if (error) {
    console.error("[contract-sign] failed:", error.message);
    return NextResponse.json({ error: "sign_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, role, locked: bothSigned });
}
