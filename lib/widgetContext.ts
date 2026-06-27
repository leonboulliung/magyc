"use client";

import { createContext, useContext } from "react";
import type { Module, ModuleStateKind, SpaceLabels } from "./types";
import type { PresetStateEntry } from "./presetState";

/**
 * Per-space context shared by every widget renderer. Carries the
 * identity / language / labels and the refresh trigger so each
 * widget doesn't have to drill 5 props through dispatcher levels.
 */
export interface WidgetContextValue {
  spaceId: string;
  /** The space's heading/title — a topic hint for widgets that want to
   *  seed themselves from context (e.g. GIF suggestions). */
  title: string;
  language: string;
  labels: SpaceLabels;
  isOwner: boolean;
  /** Anon owner token, present when isOwner && draft. */
  ownerToken: string | null;
  /** Re-fetch the space + state. Use for changes that need server-side
   *  data the client can't construct (external resolution, etc.).
   *  For a plain config edit prefer `patchModule` — it's instant. */
  refresh: () => void;
  /**
   * Optimistically replace the module at `index` in local state — no
   * refetch. The widget already knows its new config after a PUT, so
   * the UI should reflect it immediately instead of waiting on a full
   * space round-trip (the source of the "save lags" feel).
   */
  patchModule: (index: number, module: Module) => void;
  /**
   * Persist a widget config change with optimistic local apply,
   * rollback on failure, and shared save feedback.
   */
  saveModule: (
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
  ) => Promise<boolean>;
  /**
   * Post a collaborative action with optimistic local apply. The UI
   * updates instantly; the server write follows; the realtime channel
   * reconciles. Replaces the old `postState(...) + refresh()` pattern,
   * which re-fetched the whole space graph on every click.
   */
  act: (moduleIndex: number, kind: ModuleStateKind, data: Record<string, unknown>) => Promise<boolean>;
  /** Ingest an upload row returned by the direct-upload endpoint immediately.
   * Presets use their template state plane; spaces add the confirmed row to
   * live state without waiting for Realtime. */
  ingestStateEntry?: (entry: PresetStateEntry) => void;
}

export const WidgetContext = createContext<WidgetContextValue | null>(null);

export function useWidgetContext(): WidgetContextValue {
  const v = useContext(WidgetContext);
  if (!v) throw new Error("WidgetContext missing — wrap renderers in <WidgetContext.Provider>");
  return v;
}
