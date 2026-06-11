"use client";

import { createContext, useContext } from "react";
import type { Module, ModuleStateKind, SpaceLabels } from "./types";

/**
 * Per-space context shared by every widget renderer. Carries the
 * identity / language / labels and the refresh trigger so each
 * widget doesn't have to drill 5 props through dispatcher levels.
 */
export interface WidgetContextValue {
  spaceId: string;
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
   * Post a collaborative action with optimistic local apply. The UI
   * updates instantly; the server write follows; the realtime channel
   * reconciles. Replaces the old `postState(...) + refresh()` pattern,
   * which re-fetched the whole space graph on every click.
   */
  act: (moduleIndex: number, kind: ModuleStateKind, data: Record<string, unknown>) => Promise<boolean>;
}

export const WidgetContext = createContext<WidgetContextValue | null>(null);

export function useWidgetContext(): WidgetContextValue {
  const v = useContext(WidgetContext);
  if (!v) throw new Error("WidgetContext missing — wrap renderers in <WidgetContext.Provider>");
  return v;
}
