"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { readApiJson, showApiError, showActionSuccess, showUnknownError } from "@/lib/client/feedback";

interface ProjectInvitation {
  id: string;
  spaceId: string;
  projectTitle: string;
  role: "editor" | "client";
  invitedBy: string;
  expiresAt: string;
}

export function ProjectInvitations() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/project-invitations", { cache: "no-store" })
      .then(async (res) => ({ res, json: await readApiJson(res) }))
      .then(({ res, json }) => {
        if (!cancelled && res.ok && Array.isArray(json.invitations)) {
          setInvitations(json.invitations as ProjectInvitation[]);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function respond(invitation: ProjectInvitation, action: "accept" | "decline") {
    if (busyId) return;
    setBusyId(invitation.id);
    try {
      const res = await fetch("/api/project-invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invitationId: invitation.id, action }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        showApiError("Einladung nicht beantwortet", json);
        return;
      }
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      showActionSuccess(action === "accept" ? "Projektzugang angenommen" : "Einladung abgelehnt");
      if (action === "accept") router.refresh();
    } catch (error) {
      showUnknownError("Einladung nicht beantwortet", error);
    } finally {
      setBusyId(null);
    }
  }

  if (!invitations.length) return null;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3">
        <Icon icon="lucide:mail" className="h-4 w-4 text-black/45" />
        <p className="text-[13px] font-medium text-[#17171a]">Projekt-Einladungen</p>
        <span className="mono ml-auto text-[10px] text-black/35">{invitations.length}</span>
      </div>
      <div className="divide-y divide-black/[0.07]">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[#17171a]">{invitation.projectTitle}</p>
              <p className="mt-0.5 text-[12px] text-black/45">
                {invitation.invitedBy} lädt dich {invitation.role === "editor" ? "als Teammitglied" : "als Kund:in"} ein.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void respond(invitation, "decline")}
                disabled={busyId === invitation.id}
                className="rounded-full px-3.5 py-2 text-[12px] text-black/50 transition-colors hover:bg-black/[0.04] hover:text-black disabled:opacity-40"
              >
                Ablehnen
              </button>
              <button
                type="button"
                onClick={() => void respond(invitation, "accept")}
                disabled={busyId === invitation.id}
                className="rounded-full bg-[#17171a] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                Annehmen
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

