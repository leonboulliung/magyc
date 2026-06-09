"use client";

import { createContext, useContext } from "react";
import type { SpaceLabels } from "./types";

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
  /** Re-fetch the space + state. Called by widgets after PUT / regenerate. */
  refresh: () => void;
}

export const WidgetContext = createContext<WidgetContextValue | null>(null);

export function useWidgetContext(): WidgetContextValue {
  const v = useContext(WidgetContext);
  if (!v) throw new Error("WidgetContext missing — wrap renderers in <WidgetContext.Provider>");
  return v;
}
