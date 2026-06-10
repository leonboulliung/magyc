"use client";

import { createContext, useContext } from "react";
import type { ModuleStateKind, SpaceLabels } from "./types";

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
  /** Re-fetch the space + state. Called by widgets after PUT / regenerate
   *  (widget CONFIG changes). Collaborative actions use `act` instead. */
  refresh: () => void;
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
