"use client";

import { useState } from "react";
import { SpaceView } from "@/app/s/[id]/SpaceView";
import { ContractView } from "@/app/s/[id]/vertrag/ContractView";
import { AbschlussPanel } from "@/components/studio/AbschlussPanel";
import { StudioProjectBar } from "@/components/studio/StudioProjectBar";
import type { ProjectStage, Space } from "@/lib/types";
import type { ProjectAccessRole } from "@/lib/server/projectAccess";

/**
 * StudioWorkspace — the role-aware project surface. The lifecycle stage is
 * forward-only and owner-managed; the stage bar switches the VIEW between the
 * surfaces that belong to each reached stage:
 *   Planung   → the project page (read-only once the plan is locked)
 *   Absegnung → the contract, embedded in this shell (no separate page)
 *   Abschluss → the closed contract (links/references editor: next step)
 * Advancing locks the plan / closes the project; it can never be reset.
 */
export function StudioWorkspace({
  space,
  accessRole = "owner",
}: {
  space: Space;
  accessRole?: Extract<ProjectAccessRole, "owner" | "editor" | "client">;
}) {
  const stage: ProjectStage = (space.stage ?? "brief") as ProjectStage;
  const [view, setView] = useState<ProjectStage>(stage);

  return (
    <>
      <StudioProjectBar
        id={space.id}
        stage={space.stage}
        segment={space.segment}
        shared={space.shared}
        view={view}
        onView={setView}
        onAdvance={setView}
        canManage={accessRole === "owner"}
      />
      {view === "brief" ? (
        <SpaceView
          id={space.id}
          initialSpace={space}
          hideLockedNotice
          canEditOverride={accessRole === "owner" || accessRole === "editor"}
        />
      ) : (
        <div
          className="min-h-screen text-[#17171a]"
          style={{ background: "radial-gradient(circle at 50% -8%, #ffffff, #f4f4f1 55%)" }}
        >
          <div className="pt-14 sm:pt-16">
            {view === "handoff" ? (
              <AbschlussPanel id={space.id} isOwner={accessRole === "owner"} initial={space.handoff} onView={setView} />
            ) : (
              <ContractView id={space.id} spaceTitle={space.title} embedded />
            )}
          </div>
        </div>
      )}
    </>
  );
}
