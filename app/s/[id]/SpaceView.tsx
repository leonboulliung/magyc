"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useUser } from "@clerk/nextjs";
import { fetchSpaceSnapshot, fetchVersionSnapshot } from "@/lib/client/spaceRead";
import { supabase } from "@/lib/supabase";
import { apiErrorMessage, withOwnerToken } from "@/lib/client/errors";
import { readApiJson, showActionError } from "@/lib/client/feedback";
import {
  applyActionLocally,
  getSelfId,
  makeOptimisticEntry,
  postState,
  setSelfUser,
} from "@/lib/state";
import { bodyContainer, heroIn } from "@/lib/anim";
import { getSpaceOwnerToken } from "@/lib/anonId";
import { newId } from "@/lib/id";
import { colorForId } from "@/lib/palette";
import { label } from "@/lib/labels";
import { useIsOwner } from "@/lib/hooks";
import { useDevMode } from "@/lib/devFlag";
import { WidgetContext } from "@/lib/widgetContext";
import type { Module, ModuleStateEntry, ModuleStateKind, Space, SpaceStyle } from "@/lib/types";
import type { PresetStateEntry } from "@/lib/presetState";
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
import { AssistantDock } from "@/components/AssistantDock";
import { DotField } from "@/components/DotField";
import { RenderBoundary } from "@/components/ui/RenderBoundary";
import { SupportWidget } from "@/components/support/SupportWidget";

interface SpaceNotice {
  tone: "saving" | "success" | "error";
  message: string;
  actionLabel?: string;
  onAction?: (() => void) | null;
}

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
export function SpaceView({
  id,
  initialSpace = null,
  hideLockedNotice = false,
  canEditOverride,
  onProjectDataChange,
  disableRealtime = false,
  themeMode = "dark",
}: {
  id: string;
  initialSpace?: Space | null;
  hideLockedNotice?: boolean;
  canEditOverride?: boolean;
  onProjectDataChange?: (modules: Module[], state: ModuleStateEntry[]) => void;
  disableRealtime?: boolean;
  /** Canvas theme for the project page ("stage"). Owner's account preference. */
  themeMode?: "dark" | "light";
}) {
  const { user } = useUser();

  // Bridge the signed-in identity into the plain-function state layer so
  // "is this mine?", realtime dedupe, and attribution use the Clerk user
  // id/name (matching what the server stamps) instead of the anon token.
  useEffect(() => {
    setSelfUser(
      user ? { id: user.id, name: user.username ?? user.fullName ?? undefined } : null,
    );
  }, [user]);

  // Seeded from the server-rendered fetch — content is present on first
  // paint, no client fetch waterfall.
  const [space, setSpace] = useState<Space | null>(initialSpace);
  const [loaded, setLoaded] = useState(!!initialSpace);
  const [viewVersion, setViewVersion] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetchSpaceSnapshot(id)
      .then((s) => { setSpace(s); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [id]);

  // Only fetch on the client when the server didn't hand us the space
  // (transient server miss). Otherwise the initial data is enough and
  // realtime keeps it fresh — no redundant load query.
  useEffect(() => {
    if (!initialSpace) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOwner = useIsOwner(space);
  const canStructure = canEditOverride ?? isOwner;
  const devMode = useDevMode();

  const ownerToken = useMemo(() => {
    if (!space || !isOwner) return null;
    return getSpaceOwnerToken(space.id);
  }, [space, isOwner]);

  // Optimistic local copy of the current modules. Patched on config
  // edits so saves are instant; reset to server truth whenever the
  // space is (re)fetched. null until the first space load.
  const [localModules, setLocalModules] = useState<Module[] | null>(null);
  useEffect(() => { setLocalModules(space ? space.modules : null); }, [space]);
  const modulesRef = useRef<Module[]>(initialSpace?.modules ?? []);
  useEffect(() => {
    modulesRef.current = localModules ?? space?.modules ?? [];
  }, [localModules, space]);
  const patchModule = useCallback((i: number, mod: Module) => {
    setLocalModules((prev) => {
      const base = prev ?? space?.modules ?? [];
      if (i < 0 || i >= base.length) return prev;
      const next = [...base];
      next[i] = mod;
      modulesRef.current = next;
      return next;
    });
  }, [space]);

  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notice, setNotice] = useState<SpaceNotice | null>(null);
  const announce = useCallback((next: SpaceNotice | null, durationMs = 1800) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(next);
    if (next && durationMs > 0) {
      noticeTimerRef.current = setTimeout(() => setNotice((current) => (
        current === next ? null : current
      )), durationMs);
    }
  }, []);
  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  // Project-change fan-out carries invalidations only; project data is always
  // re-read through the authorized snapshot API. A per-tab id is essential:
  // two tabs signed into the same account must still synchronize each other.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const configRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeClientId = useRef(`tab-${newId()}`);
  const channelReady = useRef(false);
  const pendingBroadcasts = useRef(new Set<"config" | "state">());
  const broadcastProjectChange = useCallback((event: "config" | "state") => {
    const channel = channelRef.current;
    if (!channel || !channelReady.current) {
      pendingBroadcasts.current.add(event);
      return;
    }
    void channel.send({
      type: "broadcast",
      event,
      payload: { from: realtimeClientId.current },
    }).then((status) => {
      if (status !== "ok") pendingBroadcasts.current.add(event);
    });
  }, []);
  const broadcastConfigChange = useCallback(() => {
    broadcastProjectChange("config");
  }, [broadcastProjectChange]);
  const broadcastStateChange = useCallback(() => {
    broadcastProjectChange("state");
  }, [broadcastProjectChange]);

  const saveModule = useCallback(
    async (
      index: number,
      module: Module,
      options?: {
        note?: string;
        resolveExternal?: boolean;
        successMessage?: string;
        errorMessage?: string;
        undoModule?: Module | null;
        allowUndo?: boolean;
        quiet?: boolean;
      },
    ) => {
      if (!space?.id) return false;
      const previous = modulesRef.current[index] ?? null;
      patchModule(index, module);
      if (!options?.quiet) announce({ tone: "saving", message: "saving…" }, 0);
      try {
        const res = await fetch(`/api/spaces/${space.id}/widgets/${index}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(withOwnerToken({
            widget: module,
            modulesRev: space.modulesRev,
            note: options?.note,
            resolveExternal: options?.resolveExternal,
          }, ownerToken)),
        });
        const json = await readApiJson(res);
        if (!res.ok) throw new Error(apiErrorMessage(json, options?.errorMessage ?? "save_failed"));
        const nextRev = typeof (json as { modulesRev?: unknown })?.modulesRev === "number"
          ? (json as { modulesRev: number }).modulesRev
          : space.modulesRev + 1;
        setSpace((current) => current && current.id === space.id
          ? { ...current, modulesRev: nextRev }
          : current);
        const persisted = (json && typeof json === "object" && "widget" in json)
          ? (json as { widget?: Module }).widget
          : null;
        if (persisted) patchModule(index, persisted);
        broadcastConfigChange();
        const canUndo = options?.allowUndo !== false && options?.undoModule;
        if (!options?.quiet) {
          announce({
            tone: "success",
            message: options?.successMessage ?? "saved",
            actionLabel: canUndo ? "undo" : undefined,
            onAction: canUndo
              ? () => {
                  void saveModule(index, options.undoModule as Module, {
                    successMessage: "restored",
                    errorMessage: "restore_failed",
                    allowUndo: false,
                  });
                }
              : null,
          }, canUndo ? 5000 : 1600);
        } else {
          announce(null);
        }
        return true;
      } catch (error) {
        if (previous) patchModule(index, previous);
        announce({
          tone: "error",
          message: error instanceof Error ? error.message : options?.errorMessage ?? "save_failed",
        }, 3600);
        showActionError("Änderung nicht gespeichert", {
          description: error instanceof Error ? error.message : options?.errorMessage ?? "save_failed",
        });
        return false;
      }
    },
    [announce, broadcastConfigChange, ownerToken, patchModule, space?.id, space?.modulesRev],
  );

  // Lazy external-reference hydration. Creation stores Wikipedia widgets
  // topic-only (to stay under the serverless timeout); resolve them once
  // on first load, then refresh to show the enriched cards.
  const resolveTriedRef = useRef(false);
  useEffect(() => {
    if (!space || resolveTriedRef.current) return;
    const needs = space.modules.some((m) => m.type === "wikipedia" && !m.url);
    if (!needs) return;
    resolveTriedRef.current = true;
    fetch(`/api/spaces/${space.id}/resolve`, { method: "POST" })
      .then((r) => r.json())
      .then((j) => { if (j?.resolved) refresh(); })
      .catch(() => {});
  }, [space, refresh]);

  // ── Live collaborative state ────────────────────────────────────
  // `liveState` is the working copy of module_state: seeded from the
  // fetched space, updated (a) optimistically on own actions and
  // (b) by an authorized snapshot after another client broadcasts an
  // invalidation. No project row is read directly with the anon DB client.
  const [liveState, setLiveState] = useState<ModuleStateEntry[]>(() => initialSpace?.state ?? []);
  // Always-current snapshot of liveState, so an optimistic action can
  // roll back to the exact prior state on failure without a refetch.
  const liveStateRef = useRef<ModuleStateEntry[]>([]);
  liveStateRef.current = liveState;

  useEffect(() => {
    if (space) setLiveState(space.state);
  }, [space]);

  useEffect(() => {
    if (!space || !onProjectDataChange) return;
    onProjectDataChange(localModules ?? space.modules, liveState);
  }, [liveState, localModules, onProjectDataChange, space]);

  useEffect(() => {
    if (!space?.id || disableRealtime) return;
    const scheduleRemoteRefresh = (msg: { payload?: unknown }) => {
      const from = (msg.payload as { from?: string } | null)?.from;
      if (from === realtimeClientId.current) return;
      if (configRefreshTimer.current) clearTimeout(configRefreshTimer.current);
      configRefreshTimer.current = setTimeout(() => refresh(), 350);
    };
    const channel = supabase
      .channel(`ms-${space.id}`)
      .on("broadcast", { event: "config" }, scheduleRemoteRefresh)
      .on("broadcast", { event: "state" }, scheduleRemoteRefresh)
      .subscribe((status) => {
        channelReady.current = status === "SUBSCRIBED";
        if (status !== "SUBSCRIBED") return;
        const queued = [...pendingBroadcasts.current];
        pendingBroadcasts.current.clear();
        for (const event of queued) {
          void channel.send({
            type: "broadcast",
            event,
            payload: { from: realtimeClientId.current },
          });
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      channelReady.current = false;
      pendingBroadcasts.current.clear();
      if (configRefreshTimer.current) clearTimeout(configRefreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [disableRealtime, space?.id, refresh]);

  /** Refresh + tell other open clients to do the same — for structural
   *  changes that already go through a refresh (add/remove/reorder,
   *  style save, publish). */
  const refreshEverywhere = useCallback(() => {
    refresh();
    broadcastConfigChange();
  }, [refresh, broadcastConfigChange]);

  /** Optimistic collaborative action: apply locally with the server's
   *  semantics, fire the write, and leave the optimistic entry in place.
   *
   *  Crucially it does NOT refetch on success — the local copy already
   *  matches what we just wrote, so a full space refetch would only
   *  replace an instant update with a slow one (the source of the
   *  per-click delay on every widget, sketch included). A successful write
   *  broadcasts an invalidation so other clients refetch through the scoped
   *  read API. On rejection we roll back to the exact prior state. */
  const act = useCallback(
    async (moduleIndex: number, kind: ModuleStateKind, data: Record<string, unknown>) => {
      if (!space?.id) return false;
      if (space.stage === "production" || space.stage === "handoff") {
        showActionError("Projekt in Auswahl", { description: "Die Projektseite ist gesperrt — Änderungen sind nicht mehr möglich." });
        return false;
      }
      const snapshot = liveStateRef.current;
      const entry = makeOptimisticEntry(space.id, moduleIndex, kind, data, {
        kind: user ? "user" : "anon",
        id: user?.id ?? getSelfId(),
        displayName: user?.username ?? user?.fullName ?? undefined,
      });
      setLiveState((prev) => applyActionLocally(prev, entry));
      const result = await postState(space.id, moduleIndex, kind, data);
      if (!result.ok) {
        setLiveState(snapshot); // targeted rollback — no refetch
        showActionError("Änderung nicht gespeichert", {
          description: apiErrorMessage(result.error),
        });
      } else {
        broadcastStateChange();
      }
      return result.ok;
    },
    [broadcastStateChange, space?.id, user],
  );

  // Direct uploads are committed by the upload endpoint rather than ctx.act.
  // Ingest the returned state row immediately so the uploader does not depend
  // on a Realtime round-trip (or on Realtime being available at all).
  const ingestStateEntry = useCallback((entry: PresetStateEntry) => {
    if (!space?.id) return;
    const fullEntry: ModuleStateEntry = {
      ...entry,
      spaceId: space.id,
      actor: {
        kind: user ? "user" : "anon",
        id: user?.id ?? getSelfId(),
        displayName: user?.username ?? user?.fullName ?? undefined,
      },
    };
    setLiveState((current) => current.some((item) => item.id === fullEntry.id)
      ? current
      : [...current, fullEntry]);
    broadcastStateChange();
  }, [broadcastStateChange, space?.id, user]);

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
    () => styleVars(effectiveStyle, fontStack(findFont(effectiveStyle.font)), themeMode),
    [effectiveStyle, themeMode],
  );

  useEffect(() => {
    if (!space) return;
    document.title = space.title?.trim() || "MAGYC";
    document.documentElement.lang = (space.language || "en").split("-")[0];
  }, [space?.language, space?.title]);

  // Which version is shown. The space query no longer ships every
  // version's modules, so an OLD version's snapshot is fetched on demand.
  const latestVersion = space && space.versions.length > 0
    ? space.versions[space.versions.length - 1].version
    : 0;
  const targetVersion = viewVersion ?? latestVersion;
  const isOldVersion = targetVersion > 0 && targetVersion < latestVersion;

  const [versionModules, setVersionModules] = useState<Record<number, Module[]>>({});
  useEffect(() => {
    if (!space || !isOldVersion || versionModules[targetVersion]) return;
    let cancelled = false;
    fetchVersionSnapshot(space.id, targetVersion).then((mods) => {
      if (!cancelled && mods) setVersionModules((m) => ({ ...m, [targetVersion]: mods }));
    });
    return () => { cancelled = true; };
  }, [space, isOldVersion, targetVersion, versionModules]);

  // Which modules to render — historical snapshot or current.
  const { displayedModules, currentVersionNumber } = useMemo(() => {
    if (!space) return { displayedModules: [] as Module[], currentVersionNumber: 0 };
    if (isOldVersion) {
      // [] while the authorized version snapshot loads.
      return { displayedModules: versionModules[targetVersion] ?? [], currentVersionNumber: targetVersion };
    }
    // Current version: prefer the optimistic local copy so a just-saved
    // edit is visible immediately, without a full refetch.
    return { displayedModules: localModules ?? space.modules, currentVersionNumber: latestVersion };
  }, [space, isOldVersion, targetVersion, versionModules, localModules, latestVersion]);

  // Pre-slice the LIVE state by moduleIndex so each renderer only sees
  // its own actions. Derived from liveState (optimistic + realtime),
  // not from the fetched snapshot — this is what makes every click
  // feel instant and other users' actions appear without a reload.
  const stateByModule = useMemo(() => {
    const out = new Map<number, ModuleStateEntry[]>();
    for (const e of liveState) {
      const arr = out.get(e.moduleIndex) || [];
      arr.push(e);
      out.set(e.moduleIndex, arr);
    }
    for (const arr of out.values()) arr.sort((a, b) => a.createdAt - b.createdAt);
    return out;
  }, [liveState]);

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

  // Once a project leaves the Planung stage it is locked: the plan is frozen
  // (it becomes the contract), so the page is read-only for everyone.
  const locked = space.stage === "production" || space.stage === "handoff";
  const editable = canStructure && !locked;

  // The floating top-right pill should only appear when it actually holds a
  // control. Style edit + publish are owner-only AND only while editable.
  const showTopControls = editable || isHistorical;

  // The current viewer is a participant the moment they open the space —
  // surface them immediately (don't wait for their first edit). The owner
  // profile may be missing, so this also covers "owner not yet in the bar".
  const selfParticipant = user
    ? { id: user.id, name: user.username ?? user.fullName ?? "Du", color: colorForId(user.id) }
    : null;

  return (
    <WidgetContext.Provider
      value={{
        spaceId: space.id,
        title: space.title || "",
        language: space.language,
        labels: space.labels,
        isOwner: editable,
        ownerToken,
        refresh: refreshEverywhere,
        patchModule,
        saveModule,
        act,
        ingestStateEntry,
      }}
    >
      <div
        className={`vibe-root vibe-${space.vibe} relative min-h-screen flex flex-col overflow-hidden`}
        style={{ ...rootStyleVars, background: "var(--v-page, var(--v-bg))" }}
      >
        <DotField color={themeMode === "light" ? "0,0,0" : "255,255,255"} className="pointer-events-none fixed inset-0 z-0 opacity-[0.08] sm:opacity-[0.13]" />
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background: themeMode === "light"
              ? "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.05))"
              : "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.52))",
          }}
        />

        {/* Floating top-right controls — only when there is one to show. */}
        {showTopControls && (
        <div
          className="fixed top-3 right-3 sm:top-4 sm:right-4 z-30 flex items-center gap-1.5 sm:gap-2 px-1.5 py-1 rounded-full"
          style={{
            background: "rgba(18,18,18,0.94)",
            border: "1px solid var(--v-rule)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 12px 34px rgba(0,0,0,0.2)",
          }}
        >
          {isHistorical && (
            <button
              onClick={() => setViewVersion(null)}
              className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full"
              style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)", color: "var(--v-fg)" }}
            >
              {label(space.labels, "backToCurrent")}
            </button>
          )}
          {editable && !isHistorical && (
            <StyleEditor
              style={effectiveStyle}
              spaceId={space.id}
              ownerToken={ownerToken}
              onPreview={setStyleOverride}
              onSaved={refreshEverywhere}
            />
          )}
          <PublishButton space={space} onChanged={refreshEverywhere} />
        </div>
        )}

        {notice && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-4 sm:translate-x-0 z-40">
            <div
              className="flex items-center gap-3 px-3 py-2 rounded-full shadow-sm"
              style={{
                background: "color-mix(in srgb, var(--v-bg) 94%, transparent)",
                border: "1px solid var(--v-rule)",
                color: notice.tone === "error" ? "var(--v-fg)" : "var(--v-muted)",
              }}
            >
              <span className="mono text-[10px] tracking-widest">
                {notice.tone === "saving" ? "…" : notice.tone === "error" ? "!" : "✓"} {notice.message}
              </span>
              {notice.actionLabel && notice.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    const action = notice.onAction;
                    setNotice(null);
                    action?.();
                  }}
                  className="mono text-[10px] tracking-widest underline underline-offset-2"
                  style={{ color: "var(--v-fg)" }}
                >
                  {notice.actionLabel}
                </button>
              )}
            </div>
          </div>
        )}

        {/* HEADER ZONE — heading + rich_text, not in grid. */}
        <header className="w-full">
          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-10 pt-24 sm:pt-24 pb-8 sm:pb-12 space-y-6">
            <motion.div initial="hidden" animate="show" variants={heroIn} className="space-y-6">
              {hero.map(({ module: m, index: i }) => (
                <RenderBoundary key={`hero-${i}`} label="Kopfbereich" resetKeys={[i, m.type]}>
                  <WidgetDispatcher
                    module={m}
                    index={i}
                    state={stateByModule.get(i) ?? []}
                  />
                </RenderBoundary>
              ))}
            </motion.div>

            {tagsModule && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
              >
                <RenderBoundary label="Tags" resetKeys={[tagsIndex]}>
                  <WidgetDispatcher
                    module={tagsModule}
                    index={tagsIndex}
                    state={stateByModule.get(tagsIndex) ?? []}
                  />
                </RenderBoundary>
              </motion.div>
            )}

            {/* Participants strip — owner + everyone who has contributed. */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            >
              <ParticipantsBar
                state={liveState}
                owner={space.owner}
                self={selfParticipant}
                label={label(space.labels, "participants")}
              />
            </motion.div>
          </div>
        </header>

        {/* Locked: a slim status line (no bulky banner) with a link to the
            contract environment. Plan is frozen once it leaves Planung.
            Suppressed inside the owner workspace, where the stage bar already
            switches between plan and contract views. */}
        {locked && !hideLockedNotice && (
          <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-10">
            <Link
              href={`/s/${space.id}/vertrag`}
              className="group flex items-center justify-between gap-3 rounded-full px-4 py-2 transition-colors hover:bg-white/[0.03]"
              style={{ border: "1px solid var(--v-rule)" }}
            >
              <span className="mono flex items-center gap-2 text-[11px] tracking-widest" style={{ color: "var(--v-muted)" }}>
                <span aria-hidden>⟡</span>
                {space.stage === "handoff" ? "ABGESCHLOSSEN · PLAN GESPERRT" : "IN AUSWAHL · PLAN GESPERRT"}
              </span>
              <span className="mono text-[11px] tracking-widest transition-transform group-hover:translate-x-0.5" style={{ color: "var(--v-fg)" }}>
                Vertrag ansehen →
              </span>
            </Link>
          </div>
        )}

        {/* Historical banner. */}
        {isHistorical && (
          <div className="max-w-5xl mx-auto px-4 sm:px-10 -mt-4">
            <div
              className="mono text-[10px] tracking-widest px-3 py-2 rounded-[var(--v-radius)] inline-block"
              style={{ background: "var(--v-rule)", color: "var(--v-fg)" }}
            >
              {label(space.labels, "viewingVersionPrefix")} {currentVersionNumber} · {new Date(space.versions[currentVersionNumber - 1].createdAt).toLocaleString()}
            </div>
          </div>
        )}

        {/* MAIN: grid + version stripes. */}
        <section className="relative z-10 flex-1 w-full">
          <div className="max-w-5xl mx-auto px-4 sm:px-10 py-6 sm:py-10 flex gap-6 sm:gap-8 items-start">
            <div className="flex-1 min-w-0">
              <motion.div initial="hidden" animate="show" variants={bodyContainer}>
                <GridZone
                  bodyItems={body.map(({ module: m, index: i }) => ({
                    module: m,
                    index: i,
                  }))}
                  stateByModule={stateByModule}
                  headerModules={[...hero.map(h => h.module), ...(tagsModule ? [tagsModule] : [])]}
                  spaceId={space.id}
                  ownerToken={ownerToken}
                  isOwner={editable}
                  labels={{ emptyGrid: space.labels.emptyGrid, emptyGridHint: space.labels.emptyGridHint }}
                  modulesRev={space.modulesRev}
                  onRefresh={refreshEverywhere}
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
        <footer className="relative z-10 w-full" style={{ borderTop: "1px solid var(--v-rule)" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-10 py-5 flex items-center justify-between gap-4 flex-wrap">
            {space.visibility !== null ? <SpacePrivacy space={space} /> : <div />}
            <MagyCBadge />
          </div>
        </footer>

        {/* Dev-only: persona switcher for simulating multiplayer.
            Hidden in production; enable on any space with ?dev=1. */}
        {devMode && <PersonaSwitcher />}
        <SupportWidget spaceId={space.id} variant="project" />
        <AssistantDock spaceId={space.id} onProjectChanged={refreshEverywhere} />
      </div>
    </WidgetContext.Provider>
  );
}
