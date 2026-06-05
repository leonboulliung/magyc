"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser, SignUpButton } from "@clerk/nextjs";
import type { Card, CardRole } from "@/lib/types";

/**
 * Rollen — the "Ich mach's" surface. When a thing carries predefined
 * roles, this section lists them with their claim state. A non-joined
 * viewer can claim any open role with one tap. A joiner can switch
 * roles by tapping another open slot. The owner sees the same list
 * but read-only here (labels are curated in the edit modal).
 *
 * If the card has no predefined roles, this component renders nothing
 * — the classic "JOIN" button remains the single CTA.
 */
export function RolesArea({
  card,
  onChanged,
}: {
  card: Card;
  onChanged: () => void;
}) {
  const { user } = useUser();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!card.roles || card.roles.length === 0) return null;

  const mine = !!user && user.id === card.ownerId;
  const joinedMembers = card.members.filter((m) => m.state === "joined");
  const myJoin = user
    ? joinedMembers.find((m) => m.userId === user.id) ?? null
    : null;
  const myRole = myJoin?.role || "";
  const full =
    card.spots != null &&
    joinedMembers.length >= card.spots &&
    !myJoin;
  const requestMode = card.permission === "request";

  async function claim(role: CardRole) {
    if (!card) return;
    setBusy(role.label);
    setErr(null);
    try {
      const res = await fetch(`/api/cards/${card.id}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: role.label }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(prettyError(j.error));
        return;
      }
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function release() {
    if (!card) return;
    setBusy("__leave");
    setErr(null);
    try {
      await fetch(`/api/cards/${card.id}/join`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  const openCount = card.roles.filter((r) => !r.claimedBy).length;
  const totalCount = card.roles.length;

  return (
    <div className="border border-rule rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 mono text-[10px] tracking-widest bg-ink text-paper flex items-center justify-between">
        <span>ROLLEN · {totalCount - openCount}/{totalCount} BESETZT</span>
        {openCount > 0 && !mine && (
          <span className="opacity-70">
            {openCount === 1 ? "1 OFFEN" : `${openCount} OFFEN`}
          </span>
        )}
      </div>
      <ul className="divide-y divide-rule">
        {card.roles.map((role) => {
          const isMine =
            !!user &&
            role.claimedBy &&
            role.claimedBy.id === user.id;
          const taken = !!role.claimedBy;
          return (
            <li
              key={role.label}
              className="px-3 py-2.5 flex items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="editorial font-black text-[18px] leading-[1.05] truncate">
                  {role.label}
                </div>
                {role.claimedBy ? (
                  <Link
                    href={`/u/${role.claimedBy.id}`}
                    className="mono text-[10px] tracking-widest opacity-70 hover:underline mt-0.5 inline-block"
                  >
                    @{role.claimedBy.displayName}
                    {isMine && <span className="ml-1.5 opacity-80">· DU</span>}
                  </Link>
                ) : (
                  <div className="mono text-[10px] tracking-widest opacity-50 mt-0.5">
                    OFFEN
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {/* Owner view — read-only badges. */}
                {mine ? (
                  taken ? (
                    <span className="tag">BESETZT</span>
                  ) : (
                    <span className="tag opacity-60">OFFEN</span>
                  )
                ) : !user ? (
                  // Signed-out viewer — sign up to claim.
                  taken ? (
                    <span className="tag">BESETZT</span>
                  ) : (
                    <SignUpButton
                      mode="modal"
                      forceRedirectUrl={`/onboarding?next=/post/${card.id}`}
                    >
                      <button className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors">
                        ICH MACH&rsquo;S →
                      </button>
                    </SignUpButton>
                  )
                ) : isMine ? (
                  // Currently mine — release.
                  <button
                    onClick={release}
                    disabled={busy !== null}
                    className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors"
                  >
                    LOSLASSEN
                  </button>
                ) : taken ? (
                  // Claimed by someone else.
                  <span className="tag">BESETZT</span>
                ) : full ? (
                  <span className="tag">VOLL</span>
                ) : requestMode ? (
                  <button
                    onClick={() => claim(role)}
                    disabled={busy !== null}
                    className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors"
                  >
                    {busy === role.label ? "…" : "ANFRAGEN →"}
                  </button>
                ) : (
                  <button
                    onClick={() => claim(role)}
                    disabled={busy !== null}
                    className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors"
                  >
                    {busy === role.label
                      ? "…"
                      : myJoin && !myRole
                        ? "ICH ÜBERNEHM DAS →"
                        : myRole
                          ? "WECHSELN →"
                          : "ICH MACH'S →"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {err && (
        <div className="px-3 py-2 mono text-[10px] tracking-widest bg-paper border-t border-rule text-ink-soft">
          {err}
        </div>
      )}
    </div>
  );
}

function prettyError(code?: string): string {
  switch (code) {
    case "role_taken":
      return "Diese Rolle hat sich jemand anderes schon geschnappt.";
    case "full":
      return "Voll. Kein Slot mehr frei.";
    case "unknown_role":
      return "Diese Rolle gibt's nicht (mehr).";
    case "owner_cant_join":
      return "Du bist Owner — die Rollen sind für andere.";
    case "expired":
      return "Das Thing hat schon begonnen.";
    default:
      return code ? `Fehler: ${code}` : "Etwas ist schiefgelaufen.";
  }
}
