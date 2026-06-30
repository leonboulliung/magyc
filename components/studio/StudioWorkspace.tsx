"use client";

import { useCallback, useState } from "react";
import { SpaceView } from "@/app/s/[id]/SpaceView";
import { ContractView } from "@/app/s/[id]/vertrag/ContractView";
import { AbschlussPanel } from "@/components/studio/AbschlussPanel";
import { StudioProjectBar } from "@/components/studio/StudioProjectBar";
import { StudioThemeSync } from "@/components/studio/StudioThemeSync";
import { buildProjectFacts } from "@/lib/projectFacts";
import type { Module, ModuleStateEntry, ProjectStage, Space } from "@/lib/types";
import type { ProjectAccessRole } from "@/lib/server/projectAccess";

/**
 * StudioWorkspace — the role-aware project surface. The lifecycle stage is
 * forward-only and owner-managed; the stage bar switches the VIEW between the
 * surfaces that belong to each reached stage:
 *   Planung   → the project page (read-only once the plan is locked)
 *   Vertrag   → the contract, embedded in this shell (no separate page)
 *   Abschluss → the closed contract (links/references editor: next step)
 * Advancing locks the plan / closes the project; it can never be reset.
 */
export function StudioWorkspace({
  space,
  accessRole = "owner",
  themeMode = "light",
}: {
  space: Space;
  accessRole?: Extract<ProjectAccessRole, "owner" | "editor" | "client">;
  themeMode?: "dark" | "light";
}) {
  const stage: ProjectStage = (space.stage ?? "brief") as ProjectStage;
  const [view, setView] = useState<ProjectStage>(stage);
  const [projectFacts, setProjectFacts] = useState(() => buildProjectFacts(space.modules, space.state));
  const handleProjectDataChange = useCallback((modules: Module[], state: ModuleStateEntry[]) => {
    setProjectFacts(buildProjectFacts(modules, state));
  }, []);

  return (
    <div className="studio-theme min-h-screen" data-theme={themeMode}>
      <StudioThemeSync theme={themeMode} />
      <StudioProjectBar
        id={space.id}
        stage={space.stage}
        segment={space.segment}
        shared={space.shared}
        view={view}
        onView={setView}
        onAdvance={setView}
        canManage={accessRole === "owner"}
        canAdvance={accessRole === "owner" || accessRole === "editor"}
        surface={themeMode}
      />
      {view === "brief" ? (
        <SpaceView
          id={space.id}
          initialSpace={space}
          hideLockedNotice
          canEditOverride={space.deletedAt === null && (accessRole === "owner" || accessRole === "editor")}
          onProjectDataChange={handleProjectDataChange}
          themeMode={themeMode}
          syncDocumentTheme={false}
        />
      ) : (
        <div className="min-h-screen" style={{ background: themeMode === "dark" ? "#050505" : "#f4f4f1", color: themeMode === "dark" ? "#f4f4f1" : "#17171a" }}>
          <div className="pt-14 sm:pt-16">
            {view === "handoff" ? (
              <AbschlussPanel
                id={space.id}
                isOwner={accessRole === "owner"}
                initial={space.handoff}
                facts={projectFacts}
                onView={setView}
              />
            ) : (
              <ContractView id={space.id} spaceTitle={space.title} embedded />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
