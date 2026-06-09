"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { fetchSpaceById } from "@/lib/db";
import { bodyContainer, bodyItem, heroIn, synthesisIn } from "@/lib/anim";
import type { HeadlineModule, Module, Space, SynthesisModule } from "@/lib/types";
import { MagyCBadge } from "@/components/MagyCBadge";
import { PersonaSwitcher } from "@/components/PersonaSwitcher";
import { PublishButton } from "@/components/PublishButton";
import { SpacePrivacy } from "@/components/SpacePrivacy";
import { VersionBar } from "@/components/VersionBar";

/**
 * Space view — v4 chassis.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ HEADER  (title + synthesis, NOT part of the grid)        │
 *   ├──────────────────────────────────────┬───────────────────┤
 *   │                                      │                   │
 *   │ GRID  (12 cols, responsive)          │ VERSION STRIPES   │
 *   │                                      │ (right edge)      │
 *   │                                      │                   │
 *   ├──────────────────────────────────────┴───────────────────┤
 *   │ FOOTER  [private / public toggle]        magyc.site      │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Owner controls (publish, edit layout) float top-right.
 * Persona switcher floats bottom-left during testing.
 *
 * The grid is intentionally empty in this chassis pass; widget
 * renderers come back in over the 29-widget iteration.
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

  // Pull out headline + synthesis as header zone; the rest are body.
  const { headline, synthesis, bodyModules } = useMemo(() => {
    const head = displayedModules.find((m): m is HeadlineModule => m.type === "headline");
    const synth = displayedModules.find((m): m is SynthesisModule => m.type === "synthesis");
    const body = displayedModules.filter((m) => m.type !== "headline" && m.type !== "synthesis");
    return { headline: head, synthesis: synth, bodyModules: body };
  }, [displayedModules]);

  if (!loaded) return <div className="min-h-screen bg-white" />;
  if (!space) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="font-black text-[32px]">—</div>
          <a href="/" className="mono text-[10px] tracking-widest hover:underline">back</a>
        </div>
      </main>
    );
  }

  const isHistorical = currentVersionNumber > 0 &&
    space.versions.length > 0 &&
    currentVersionNumber < space.versions[space.versions.length - 1].version;

  return (
    <div className={`vibe-root vibe-${space.vibe} min-h-screen flex flex-col`}>
      {/* Floating top-right controls */}
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

      {/* HEADER ZONE — not in grid. */}
      <header className="w-full">
        <div className="max-w-5xl mx-auto px-4 sm:px-10 pt-14 sm:pt-20 pb-8 sm:pb-12">
          <motion.div initial="hidden" animate="show" variants={heroIn}>
            <h1 className="vibe-heading font-black text-[40px] sm:text-[64px] leading-[0.95]">
              {headline?.title ?? space.title ?? "—"}
            </h1>
            {headline?.subtitle && (
              <p className="vibe-muted text-[16px] sm:text-[19px] mt-3 leading-snug max-w-2xl">
                {headline.subtitle}
              </p>
            )}
          </motion.div>

          {synthesis && (
            <motion.p
              initial="hidden"
              animate="show"
              variants={synthesisIn}
              className="vibe-heading text-[17px] sm:text-[19px] leading-relaxed mt-6 sm:mt-8 max-w-2xl"
            >
              {synthesis.text}
            </motion.p>
          )}
        </div>
      </header>

      {/* Historical banner (rare). */}
      {isHistorical && (
        <div className="max-w-5xl mx-auto px-4 sm:px-10 -mt-4">
          <div
            className="mono text-[10px] tracking-widest px-3 py-2 rounded-md inline-block"
            style={{ background: "var(--v-rule)", color: "var(--v-fg)" }}
          >
            VIEWING VERSION {currentVersionNumber} · {new Date(space.versions[currentVersionNumber - 1].createdAt).toLocaleString()}
          </div>
        </div>
      )}

      {/* MAIN: grid + version stripes on the right. */}
      <section className="flex-1 w-full">
        <div className="max-w-5xl mx-auto px-4 sm:px-10 py-6 sm:py-10 flex gap-6 sm:gap-8 items-start">
          {/* Grid column. */}
          <div className="flex-1 min-w-0">
            {bodyModules.length === 0 ? (
              <EmptyGrid />
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={bodyContainer}
                className="grid grid-cols-12 gap-3 sm:gap-4"
              >
                {bodyModules.map((m, i) => (
                  <motion.div
                    key={i}
                    variants={bodyItem}
                    className="col-span-12 sm:col-span-6 lg:col-span-6"
                  >
                    <ModulePlaceholder type={m.type} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Version stripes — right edge, vertical. */}
          <aside className="shrink-0 self-stretch flex items-start pt-2">
            <VersionBar
              versions={space.versions}
              currentVersion={currentVersionNumber}
              onSelect={(v) => setViewVersion(v)}
            />
          </aside>
        </div>
      </section>

      {/* FOOTER — privacy toggle + brand. */}
      <footer className="w-full" style={{ borderTop: "1px solid var(--v-rule)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-10 py-5 flex items-center justify-between gap-4 flex-wrap">
          <SpacePrivacy space={space} />
          <MagyCBadge />
        </div>
      </footer>

      {/* Persona switcher — bottom-left, testing only. */}
      <PersonaSwitcher />
    </div>
  );
}

/* ============================================================
   Empty-grid placeholder — visible while the chassis has no widgets
   ============================================================ */

function EmptyGrid() {
  return (
    <div
      className="rounded-md flex items-center justify-center"
      style={{
        minHeight: "320px",
        border: "1px dashed var(--v-rule)",
        background:
          "repeating-linear-gradient(to right, transparent, transparent calc((100% / 12) - 1px), var(--v-rule) calc((100% / 12) - 1px), var(--v-rule) calc((100% / 12)))",
      }}
    >
      <div className="text-center space-y-1.5 px-4">
        <div className="mono text-[10px] tracking-widest" style={{ color: "var(--v-muted)" }}>
          EMPTY GRID · 12 COLUMNS
        </div>
        <div className="mono text-[10px] tracking-widest opacity-50" style={{ color: "var(--v-muted)" }}>
          widgets land here
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Placeholder for an actual widget — during the 29-widget iteration
   each renderer comes back online and replaces this stub.
   ============================================================ */

function ModulePlaceholder({ type }: { type: string }) {
  return (
    <div
      className="rounded-md p-4 h-full min-h-[120px] flex flex-col gap-2"
      style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)" }}
    >
      <div className="mono text-[10px] tracking-widest" style={{ color: "var(--v-muted)" }}>
        {type.replace("_", " ")}
      </div>
      <div className="mono text-[10px] opacity-50" style={{ color: "var(--v-muted)" }}>
        renderer pending
      </div>
    </div>
  );
}
