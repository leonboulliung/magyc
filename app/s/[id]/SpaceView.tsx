"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { fetchSpaceById } from "@/lib/db";
import { bodyContainer, heroIn } from "@/lib/anim";
import { getSpaceOwnerToken } from "@/lib/anonId";
import { label } from "@/lib/labels";
import { useIsOwner } from "@/lib/hooks";
import { WidgetContext } from "@/lib/widgetContext";
import type { Module, ModuleStateEntry, Space, SpaceStyle } from "@/lib/types";
import { DEFAULT_STYLE, styleVars } from "@/lib/style";
import { findFont, fontStack, googleFontsHref } from "@/lib/fonts";
import { MagyCBadge } from "@/components/MagyCBadge";
import { PersonaSwitcher } from "@/components/PersonaSwitcher";
import { PublishButton } from "@/components/PublishButton";
import { SpacePrivacy } from "@/components/SpacePrivacy";
import { VersionBar } from "@/components/VersionBar";
import { WidgetDispatcher } from "@/components/widgets/WidgetDispatcher";
import { GridZone } from "@/components/GridZone";
import { ParticipantsBar } from "@/components/ParticipantsBar";
import { StyleEditor } from "@/components/StyleEditor";

/**
 * Space view — v4 chassis with the Phase-1 widget renderers wired in.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ HEADER  Heading + Rich Text                              │
 *   │ TAGS                                                     │
 *   ├──────────────────────────────────────┬───────────────────┤
 *   │ GRID  (12 cols)                      │ VERSION STRIPES   │
 *   ├──────────────────────────────────────┴───────────────────┤
 *   │ private / public                          magyc.site     │
 *   └──────────────────────────────────────────────────────────┘
 *
 * The dispatcher decides what renders. Phase-1 ships Heading,
 * Rich Text, and Tags as real editable renderers; everything else
 * falls to a pending placeholder which is replaced phase by phase.
 */
export function SpaceView({ id }: { id: string }) {
  const [space, setSpace] = useState<Space | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewVersion, setViewVersion] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetchSpaceById(id)
      .then((s) => { setSpace(s); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  const isOwner = useIsOwner(space);

  const ownerToken = useMemo(() => {
    if (!space || !isOwner) return null;
    return getSpaceOwnerToken(space.id);
  }, [space, isOwner]);

  // ── Visual style ────────────────────────────────────────────────
  // Local override lets the StyleEditor preview changes instantly
  // before the server round-trip. Falls back to the space's stored
  // style, then to a neutral default.
  const [styleOverride, setStyleOverride] = useState<SpaceStyle | null>(null);
  const effectiveStyle: SpaceStyle = styleOverride ?? space?.style ?? DEFAULT_STYLE;

  // Load the chosen Google Font (injects one <link> per family, kept
  // around so switching fonts doesn't thrash the DOM).
  useEffect(() => {
    const spec = findFont(effectiveStyle.font);
    if (!spec) return;
    const id = `gfont-${spec.name.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = googleFontsHref([spec]);
    document.head.appendChild(link);
  }, [effectiveStyle.font]);

  const rootStyleVars = useMemo(
    () => styleVars(effectiveStyle, fontStack(findFont(effectiveStyle.font))),
    [effectiveStyle],
  );

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

  // Pre-slice state by moduleIndex once so each renderer only sees
  // its own actions. The slice is keyed by index and sorted oldest-
  // first so renderers can fold a chronological log directly.
  const stateByModule = useMemo(() => {
    const out = new Map<number, ModuleStateEntry[]>();
    if (!space) return out;
    for (const e of space.state) {
      const arr = out.get(e.moduleIndex) || [];
      arr.push(e);
      out.set(e.moduleIndex, arr);
    }
    for (const arr of out.values()) arr.sort((a, b) => a.createdAt - b.createdAt);
    return out;
  }, [space]);

  // Split into header zones + body.
  const { hero, tagsModule, tagsIndex, body } = useMemo(() => {
    const heroItems: { module: Module; index: number }[] = [];
    let tagsM: Module | null = null;
    let tagsI = -1;
    const bodyItems: { module: Module; index: number }[] = [];
    displayedModules.forEach((m, i) => {
      if (m.type === "heading" || m.type === "rich_text") {
        heroItems.push({ module: m, index: i });
      } else if (m.type === "tags") {
        tagsM = m;
        tagsI = i;
      } else {
        bodyItems.push({ module: m, index: i });
      }
    });
    return { hero: heroItems, tagsModule: tagsM, tagsIndex: tagsI, body: bodyItems };
  }, [displayedModules]);

  if (!loaded) return <div className="min-h-screen bg-white" />;
  if (!space) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="font-black text-[32px]">—</div>
          <a href="/" className="mono text-[10px] tracking-widest hover:underline">←</a>
        </div>
      </main>
    );
  }

  const isHistorical = currentVersionNumber > 0 &&
    space.versions.length > 0 &&
    currentVersionNumber < space.versions[space.versions.length - 1].version;

  return (
    <WidgetContext.Provider
      value={{
        spaceId: space.id,
        language: space.language,
        labels: space.labels,
        isOwner,
        ownerToken,
        refresh,
      }}
    >
      <div
        className={`vibe-root vibe-${space.vibe} min-h-screen flex flex-col`}
        style={{ ...rootStyleVars, background: "var(--v-page, var(--v-bg))" }}
      >
        {/* Floating top-right controls */}
        <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
          {isHistorical && (
            <button
              onClick={() => setViewVersion(null)}
              className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full"
              style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)", color: "var(--v-fg)" }}
            >
              {label(space.labels, "backToCurrent")}
            </button>
          )}
          {isOwner && !isHistorical && (
            <StyleEditor
              style={effectiveStyle}
              spaceId={space.id}
              ownerToken={ownerToken}
              onPreview={setStyleOverride}
              onSaved={refresh}
            />
          )}
          <PublishButton space={space} onChanged={refresh} />
        </div>

        {/* HEADER ZONE — heading + rich_text, not in grid. */}
        <header className="w-full">
          <div className="max-w-5xl mx-auto px-4 sm:px-10 pt-14 sm:pt-20 pb-8 sm:pb-12 space-y-6">
            <motion.div initial="hidden" animate="show" variants={heroIn} className="space-y-6">
              {hero.map(({ module: m, index: i }) => (
                <WidgetDispatcher
                  key={`hero-${i}`}
                  module={m}
                  index={i}
                  state={stateByModule.get(i) ?? []}
                />
              ))}
            </motion.div>

            {tagsModule && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
              >
                <WidgetDispatcher
                  module={tagsModule}
                  index={tagsIndex}
                  state={stateByModule.get(tagsIndex) ?? []}
                />
              </motion.div>
            )}

            {/* Participants strip — owner + everyone who has contributed. */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            >
              <ParticipantsBar
                state={space.state}
                owner={space.owner}
                label={label(space.labels, "participants")}
              />
            </motion.div>
          </div>
        </header>

        {/* Historical banner. */}
        {isHistorical && (
          <div className="max-w-5xl mx-auto px-4 sm:px-10 -mt-4">
            <div
              className="mono text-[10px] tracking-widest px-3 py-2 rounded-md inline-block"
              style={{ background: "var(--v-rule)", color: "var(--v-fg)" }}
            >
              {label(space.labels, "viewingVersionPrefix")} {currentVersionNumber} · {new Date(space.versions[currentVersionNumber - 1].createdAt).toLocaleString()}
            </div>
          </div>
        )}

        {/* MAIN: grid + version stripes. */}
        <section className="flex-1 w-full">
          <div className="max-w-5xl mx-auto px-4 sm:px-10 py-6 sm:py-10 flex gap-6 sm:gap-8 items-start">
            <div className="flex-1 min-w-0">
              <motion.div initial="hidden" animate="show" variants={bodyContainer}>
                <GridZone
                  bodyItems={body.map(({ module: m, index: i }) => ({
                    module: m,
                    index: i,
                    stateEntries: stateByModule.get(i) ?? [],
                  }))}
                  headerModules={[...hero.map(h => h.module), ...(tagsModule ? [tagsModule] : [])]}
                  spaceId={space.id}
                  ownerToken={ownerToken}
                  isOwner={isOwner}
                  labels={{ emptyGrid: space.labels.emptyGrid, emptyGridHint: space.labels.emptyGridHint }}
                  onRefresh={refresh}
                />
              </motion.div>
            </div>

            <aside className="shrink-0 self-stretch flex items-start pt-2">
              <VersionBar
                versions={space.versions}
                currentVersion={currentVersionNumber}
                onSelect={(v) => setViewVersion(v)}
              />
            </aside>
          </div>
        </section>

        {/* FOOTER. */}
        <footer className="w-full" style={{ borderTop: "1px solid var(--v-rule)" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-10 py-5 flex items-center justify-between gap-4 flex-wrap">
            <SpacePrivacy space={space} />
            <MagyCBadge />
          </div>
        </footer>

        <PersonaSwitcher />
      </div>
    </WidgetContext.Provider>
  );
}
