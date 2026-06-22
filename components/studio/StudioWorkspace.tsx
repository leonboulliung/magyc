"use client";

import { useState } from "react";
import { SpaceView } from "@/app/s/[id]/SpaceView";
import { ContractView } from "@/app/s/[id]/vertrag/ContractView";
import { StudioProjectBar } from "@/components/studio/StudioProjectBar";
import type { ProjectStage, Space } from "@/lib/types";

/**
 * StudioWorkspace — the owner's project surface. The lifecycle stage is
 * forward-only; the stage bar switches the VIEW between the surfaces that
 * belong to each reached stage:
 *   Planung   → the project page (read-only once the plan is locked)
 *   Absegnung → the contract, embedded in this shell (no separate page)
 *   Abschluss → the closed contract (links/references editor: next step)
 * Advancing locks the plan / closes the project; it can never be reset.
 */
export function StudioWorkspace({ space }: { space: Space }) {
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
      />
      {view === "brief" ? (
        <SpaceView id={space.id} initialSpace={space} hideLockedNotice />
      ) : (
        <div
          className="min-h-screen text-white"
          style={{ background: "radial-gradient(circle at 50% -10%, #14171c, #050505 60%)" }}
        >
          <div className="pt-14 sm:pt-16">
            <ContractView id={space.id} spaceTitle={space.title} embedded />
          </div>
        </div>
      )}
    </>
  );
}
