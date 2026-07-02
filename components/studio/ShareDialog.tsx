"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import {
  readApiJson,
  showActionError,
  showActionSuccess,
  showApiError,
  showUnknownError,
} from "@/lib/client/feedback";

/**
 * ShareDialog — turn unlisted sharing on/off for a suite project and copy
 * the link. While off, the project is private (owner-only). While on,
 * anyone with the /s/[id] link can view and collaborate (structural edits
 * stay owner-only). Used from the dashboard card menu and the project bar.
 */
export function ShareDialog({
  id,
  initialShared,
  open,
  onOpenChange,
}: {
  id: string;
  initialShared: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [shared, setShared] = useState(initialShared);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [memberBusy, setMemberBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"editor" | "client">("client");

  const link = typeof window !== "undefined" ? `${window.location.origin}/s/${id}` : `/s/${id}`;

  useEffect(() => {
    setShared(initialShared);
  }, [initialShared, open]);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/projects/${id}/members`, { cache: "no-store" })
      .then(readApiJson)
      .then((json) => {
        setMembers(Array.isArray(json.members) ? json.members as ProjectMember[] : []);
        setInvitations(Array.isArray(json.invitations) ? json.invitations as ProjectInvitation[] : []);
      })
      .catch(() => { setMembers([]); setInvitations([]); });
  }, [id, open]);

  async function addMember() {
    if (memberBusy || !email.trim()) return;
    setMemberBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, displayName, role }),
      });
      const json = await readApiJson(res);
      if (!res.ok || !json.invitation) {
        showApiError("Einladung nicht gespeichert", json);
        return;
      }
      setInvitations((current) => [
        ...current.filter((item) => item.id !== (json.invitation as ProjectInvitation).id && item.email !== (json.invitation as ProjectInvitation).email),
        json.invitation as ProjectInvitation,
      ]);
      setEmail("");
      setDisplayName("");
      showActionSuccess("Einladung erstellt", { description: "Zugriff entsteht erst nach der Annahme." });
      router.refresh();
    } catch (error) {
      showUnknownError("Einladung nicht gespeichert", error);
    } finally {
      setMemberBusy(false);
    }
  }

  async function updateMember(memberId: string, nextRole: "editor" | "client", kind: "member" | "invitation") {
    const previousMembers = members;
    const previousInvitations = invitations;
    const pending = invitations.some((item) => item.id === memberId);
    if (pending) {
      setInvitations((current) => current.map((item) => item.id === memberId ? { ...item, role: nextRole } : item));
    } else {
      setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role: nextRole } : member));
    }
    const res = await fetch(`/api/projects/${id}/members`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, role: nextRole, kind }),
    });
    if (!res.ok) {
      setMembers(previousMembers);
      setInvitations(previousInvitations);
      showApiError("Rolle nicht geändert", await readApiJson(res));
    }
  }

  async function removeMember(memberId: string, kind: "member" | "invitation") {
    const previousMembers = members;
    const previousInvitations = invitations;
    const pending = invitations.some((item) => item.id === memberId);
    if (pending) setInvitations((current) => current.filter((item) => item.id !== memberId));
    else setMembers((current) => current.filter((member) => member.id !== memberId));
    const res = await fetch(`/api/projects/${id}/members`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, kind }),
    });
    if (!res.ok) {
      setMembers(previousMembers);
      setInvitations(previousInvitations);
      showApiError("Zugang nicht entfernt", await readApiJson(res));
    } else {
      router.refresh();
    }
  }

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    const prev = shared;
    setShared(next); // optimistic
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared: next }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        setShared(prev);
        showApiError(next ? "Teilen fehlgeschlagen" : "Privat-Schalten fehlgeschlagen", json, {
          fallback: next
            ? "Der Projektlink konnte gerade nicht aktiviert werden."
            : "Das Projekt konnte gerade nicht privat geschaltet werden.",
        });
      } else {
        showActionSuccess(next ? "Projektlink aktiviert" : "Projekt ist privat");
        router.refresh();
      }
    } catch (error) {
      setShared(prev);
      showUnknownError(next ? "Teilen fehlgeschlagen" : "Privat-Schalten fehlgeschlagen", error, {
        fallback: next
          ? "Der Projektlink konnte gerade nicht aktiviert werden."
          : "Das Projekt konnte gerade nicht privat geschaltet werden.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showActionSuccess("Link kopiert");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showActionError("Kopieren nicht möglich", {
        description: "Der Link wird deshalb zum manuellen Kopieren angezeigt.",
      });
      window.prompt("Link", link);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Projekt teilen" maxWidth={460}>
      <div className="overflow-hidden rounded-2xl border border-black/12 bg-white text-[#17171a] shadow-2xl">
        <div className="max-h-[85vh] overflow-y-auto p-6">
        <h2 className="font-brand text-[20px] font-bold tracking-[-0.01em]">Projekt teilen</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-black/60">
          Wer den Link hat, kann das Projekt sehen und mitarbeiten (kommentieren, abstimmen,
          hochladen). Struktur ändern kannst nur du.
        </p>

        <button
          type="button"
          onClick={() => toggle(!shared)}
          disabled={busy}
          role="switch"
          aria-checked={shared}
          className="mt-5 flex w-full items-center justify-between rounded-xl border border-black/12 bg-white px-4 py-3 text-left transition-colors hover:border-black/25 disabled:opacity-60"
        >
          <span>
            <span className="block text-[15px] font-medium text-[#17171a]">
              {shared ? "Geteilt" : "Privat"}
            </span>
            <span className="block text-[13px] text-black/55">
              {shared ? "Über den Link erreichbar" : "Nur für dich sichtbar"}
            </span>
          </span>
          {/* toggle pill */}
          <span
            className="relative h-6 w-11 shrink-0 rounded-full border transition-colors"
            style={{
              background: shared ? "var(--studio-ink)" : "var(--studio-rule)",
              borderColor: shared ? "var(--studio-ink)" : "var(--studio-rule)",
            }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all"
              style={{ left: shared ? 22 : 2 }}
            />
          </span>
        </button>

        {shared && (
          <div className="mt-4">
            <div className="mono mb-1.5 text-[10px] uppercase tracking-widest text-black/40">Link</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-xl border border-black/12 bg-white px-3 py-2.5 text-[13px] text-black/80 outline-none"
              />
              <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-xl bg-[#17171a] px-4 py-2.5 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
              >
                {copied ? "Kopiert ✓" : "Kopieren"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-black/10 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-medium text-[#17171a]">Direkter Projektzugang</h3>
              <p className="mt-0.5 text-[12px] text-black/45">Team bearbeitet die Planung, Kunden arbeiten an Auswahl und Feedback.</p>
            </div>
            <span className="mono text-[10px] text-black/35">{members.length + invitations.length}</span>
          </div>

          {(members.length > 0 || invitations.length > 0) && (
            <div className="mt-3 space-y-1.5">
              {[
                ...members.map((member) => ({ ...member, kind: "member" as const, pending: false })),
                ...invitations.map((item) => ({ ...item, user_id: null, kind: item.legacy ? "member" as const : "invitation" as const, pending: true })),
              ].map((member) => (
                <div key={`${member.kind}:${member.id}`} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[#17171a]">{member.display_name || member.email}</div>
                    <div className="truncate text-[11px] text-black/40">
                      {member.email} · {member.pending ? "Einladung ausstehend" : "Zugang aktiv"}
                    </div>
                  </div>
                  <select
                    value={member.role}
                    onChange={(event) => void updateMember(member.id, event.target.value as "editor" | "client", member.kind)}
                    className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[11px] text-black/65 outline-none"
                  >
                    <option value="editor">Team</option>
                    <option value="client">Kunde</option>
                  </select>
                  <button type="button" onClick={() => void removeMember(member.id, member.kind)} aria-label={member.pending ? "Einladung zurückziehen" : "Zugang entfernen"} className="grid h-7 w-7 place-items-center text-[14px] text-black/35 hover:text-black">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="E-Mail-Adresse" className="min-w-0 rounded-xl border border-black/12 bg-white px-3 py-2 text-[12px] text-[#17171a] outline-none focus:border-black/30" />
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Name (optional)" className="min-w-0 rounded-xl border border-black/12 bg-white px-3 py-2 text-[12px] text-[#17171a] outline-none focus:border-black/30" />
            <select value={role} onChange={(event) => setRole(event.target.value as "editor" | "client")} className="rounded-xl border border-black/12 bg-white px-3 py-2 text-[12px] text-[#17171a] outline-none">
              <option value="client">Kunde</option>
              <option value="editor">Team</option>
            </select>
          </div>
          <button type="button" onClick={() => void addMember()} disabled={memberBusy || !email.trim()} className="mt-2 rounded-full bg-[#17171a] px-4 py-2 text-[12px] font-medium text-white disabled:opacity-35">
            Einladung senden
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mono text-[12px] uppercase tracking-widest text-black/55 hover:text-[#17171a]"
          >
            Schließen
          </button>
        </div>
        </div>
      </div>
    </Dialog>
  );
}

interface ProjectMember {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  role: "editor" | "client";
  created_at: string;
}

interface ProjectInvitation {
  id: string;
  email: string;
  display_name: string | null;
  role: "editor" | "client";
  status: "pending";
  expires_at: string;
  created_at: string;
  legacy?: boolean;
}
