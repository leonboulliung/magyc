"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchSpaceById } from "@/lib/db";
import type { Module, Space } from "@/lib/types";
import { ModuleRenderer } from "@/components/modules";
import { PublishButton } from "@/components/PublishButton";
import { VersionBar } from "@/components/VersionBar";

/**
 * Space view.
 *
 *   - Drafts:   no version bar, publish button visible to the owner.
 *   - Published: version bar visible at left edge; clicking a dash
 *                switches the rendered modules to that snapshot.
 *
 * When viewing a historical version, the modules come from
 * `space.versions[n-1].modules`. Reactive state still comes from the
 * current `module_state` (interactions live across versions until we
 * have a reason to scope them).
 */
export function SpaceView({ id }: { id: string }) {
  const [space, setSpace] = useState<Space | null>(null);
  const [loaded, setLoaded] = useState(false);
  /** Which version number is shown. null = current (latest). */
  const [viewVersion, setViewVersion] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetchSpaceById(id)
      .then((s) => { setSpace(s); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Which modules to render — historical snapshot or current.
  const { displayedModules, currentVersionNumber } = useMemo(() => {
    if (!space) return { displayedModules: [] as Module[], currentVersionNumber: 0 };
    const latest = space.versions.length > 0 ? space.versions[space.versions.length - 1].version : 0;
    const target = viewVersion ?? latest;
    if (target > 0 && target < latest) {
      const v = space.versions.find((vv) => vv.version === target);
      if (v) return { displayedModules: v.modules, currentVersionNumber: target };
    }
    return { displayedModules: space.modules, currentVersionNumber: latest };
  }, [space, viewVersion]);

  if (!loaded) return <div className="min-h-screen bg-white" />;
  if (!space) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="font-black text-[32px]">—</div>
          <Link href="/" className="mono text-[10px] tracking-widest hover:underline">back</Link>
        </div>
      </main>
    );
  }

  const heroModules: Module[] = [];
  const bodyModules: { module: Module; originalIndex: number }[] = [];
  displayedModules.forEach((m, i) => {
    if (m.type === "headline" || m.type === "synthesis") {
      heroModules.push(m);
    } else {
      bodyModules.push({ module: m, originalIndex: i });
    }
  });

  const isHistorical = currentVersionNumber > 0 &&
    space.versions.length > 0 &&
    currentVersionNumber < space.versions[space.versions.length - 1].version;

  return (
    <div className={`vibe-root vibe-${space.vibe} min-h-screen`}>
      {/* Version bar — only on published spaces. */}
      <VersionBar
        versions={space.versions}
        currentVersion={currentVersionNumber}
        onSelect={(v) => setViewVersion(v)}
      />

      {/* Owner-only publish button — top-right floating. */}
      <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
        {isHistorical && (
          <button
            onClick={() => setViewVersion(null)}
            className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full"
            style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)", color: "var(--v-fg)" }}
          >
            back to current
          </button>
        )}
        <PublishButton space={space} onChanged={refresh} />
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-12 sm:py-20 space-y-10">
        {/* Historical mode banner */}
        {isHistorical && (
          <div className="mono text-[10px] tracking-widest px-3 py-2 rounded-md" style={{ background: "var(--v-rule)", color: "var(--v-fg)" }}>
            VIEWING VERSION {currentVersionNumber} · {new Date(space.versions[currentVersionNumber - 1].createdAt).toLocaleString()}
          </div>
        )}

        {/* HERO — headline + synthesis. */}
        <div className="space-y-2">
          {heroModules.map((m, i) => (
            <ModuleRenderer
              key={`hero-${i}`}
              spaceId={space.id}
              module={m}
              moduleIndex={displayedModules.indexOf(m)}
              state={isHistorical ? [] : space.state}
              onChanged={refresh}
            />
          ))}
        </div>

        {/* BODY — the rest. */}
        <div className="space-y-4">
          {bodyModules.map(({ module: m, originalIndex }) => (
            <ModuleRenderer
              key={`body-${originalIndex}`}
              spaceId={space.id}
              module={m}
              moduleIndex={originalIndex}
              state={isHistorical ? [] : space.state}
              onChanged={refresh}
            />
          ))}
        </div>

        <footer className="pt-8 flex items-center justify-between" style={{ borderTop: "1px solid var(--v-rule)" }}>
          <Link href="/" className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100">
            ← neu
          </Link>
          <span className="mono text-[9px] tracking-widest opacity-30">CREATOR</span>
        </footer>
      </main>
    </div>
  );
}
