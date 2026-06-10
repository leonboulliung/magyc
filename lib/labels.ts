import type { SpaceLabels } from "./types";

/**
 * Symbol fallbacks — used when a label key is absent from the space's
 * AI-generated labels object. Universal Unicode symbols keep the
 * surface legible without imposing a system language.
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
