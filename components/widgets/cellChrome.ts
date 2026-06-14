"use client";

import { createContext, useContext } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

/**
 * Per-cell chrome — the reorder/resize/remove actions a GridZone cell
 * owns, handed down so WidgetShell can render them in the SAME bar as the
 * widget's own affordances (regenerate / prompt-edit). One toolbar per
 * element instead of two floating clusters. Null when a widget isn't in a
 * grid cell (e.g. header widgets).
 */
export interface CellChrome {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  setActivatorNodeRef: (el: HTMLElement | null) => void;
  onRemove: () => void;
  onToggleFull: () => void;
  isFull: boolean;
  busy: boolean;
}

export const CellChromeContext = createContext<CellChrome | null>(null);

export function useCellChrome(): CellChrome | null {
  return useContext(CellChromeContext);
}
