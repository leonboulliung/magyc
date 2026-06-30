import type { SpaceLabels } from "./types";

/**
 * Symbol fallbacks — used when a label key is absent from the space's
 * AI-generated labels object. Universal Unicode symbols keep legacy
 * and partially generated spaces usable without changing their language.
 *
 * Rule: every key in SpaceLabels has a fallback here. Components
 * always read through `label(space.labels, "key")` and never check
 * for presence themselves.
 */
const FALLBACKS: Required<Pick<SpaceLabels,
  | "publishCta" | "publishTitle" | "publishExplanation"
  | "cancel" | "publishConfirm"
  | "signInPrompt" | "signInCta" | "signedInAs"
  | "visibilityPublic" | "visibilityPrivate" | "copy" | "copied"
  | "backToCurrent" | "viewingVersionPrefix"
  | "emptyGrid" | "emptyGridHint"
  | "participants"
  | "rendererPending"
>> = {
  publishCta:           "↗",
  publishTitle:         "↗",
  publishExplanation:   "",
  cancel:               "×",
  publishConfirm:       "✓",
  signInPrompt:         "",
  signInCta:            "→",
  signedInAs:           "@",
  visibilityPublic:     "○",
  visibilityPrivate:    "●",
  copy:                 "⎘",
  copied:               "✓",
  backToCurrent:        "↻",
  viewingVersionPrefix: "v",
  emptyGrid:            "▢",
  emptyGridHint:        "",
  participants:         "",
  rendererPending:      "…",
};

export function label(
  labels: SpaceLabels | undefined,
  key: keyof typeof FALLBACKS,
): string {
  const v = labels?.[key];
  return typeof v === "string" ? v : FALLBACKS[key];
}

/**
 * The canonical list of AI-generated label keys — the string fields the
 * classifier authors and that are read back from storage. Single source
 * shared by the classifier and the db mapper (rendererPending is excluded:
 * it is a fallback-only symbol, never generated or stored).
 */
export const AI_LABEL_KEYS: readonly (keyof SpaceLabels)[] = [
  "publishCta", "publishTitle", "publishExplanation", "cancel",
  "publishConfirm", "signInPrompt", "signInCta", "signedInAs",
  "visibilityPublic", "visibilityPrivate", "copy", "copied",
  "backToCurrent", "viewingVersionPrefix",
  "emptyGrid", "emptyGridHint", "participants",
];
