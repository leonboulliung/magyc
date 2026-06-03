"use client";

import { useState } from "react";
import { CardCreate, type CardDraft } from "./CardCreate";
import { IdeaComposer } from "./IdeaComposer";
import { PromptStep } from "./PromptStep";

type Stage = "prompt" | "idea" | "thing";

/**
 * Orchestrator for the create flow. The form is the entry point — typing
 * is the default path, the AI helper is an opt-in detour.
 *
 *   • IDEA path (default for "+"): the lightweight composer for a thought.
 *   • THING path: the full structured composer (time, place, spots).
 *   • PROMPT (AI helper): typed sentence → model decides idea/thing,
 *     pre-fills the form. Reachable from either composer via
 *     "✦ Draft from a sentence", never the first thing the user sees.
 *
 * Per FEEDBACK §6: previous default was prompt-first, which felt
 * unfamiliar. Now the manual form is the unsurprising entry, and the AI
 * is a peer-weight helper rather than a gate.
 */
export function CardComposer({
  onClose,
  initialKind = "idea",
}: {
  onClose: () => void;
  initialKind?: "idea" | "thing";
}) {
  // Form first. The user only sees prompt if they tap the AI helper.
  const [stage, setStage] = useState<Stage>(initialKind);
  const [draft, setDraft] = useState<CardDraft | null>(null);
  // Where to return when the user cancels out of the AI prompt.
  const [previousStage, setPreviousStage] = useState<"idea" | "thing">(initialKind);
  // Track whether the form was reached via the AI prompt. If yes, the
  // form keeps a "← BACK" affordance to the prompt; if no, no back arrow
  // (because there's nowhere obvious to go).
  const [cameFromPrompt, setCameFromPrompt] = useState(false);

  const goToPrompt = (from: "idea" | "thing") => {
    setPreviousStage(from);
    setStage("prompt");
  };

  if (stage === "prompt") {
    return (
      <div className="h-full w-full animate-fadeIn">
        <PromptStep
          initialKind={previousStage}
          onProceed={(kind, d) => {
            setDraft(d);
            setStage(kind);
            setCameFromPrompt(true);
          }}
          onClose={onClose}
          onCancel={() => {
            // Back to the form the user came from, no draft applied.
            setStage(previousStage);
          }}
        />
      </div>
    );
  }

  if (stage === "idea") {
    return (
      <div key="idea" className="h-full w-full animate-fadeIn">
        <IdeaComposer
          onClose={onClose}
          onBack={cameFromPrompt ? () => setStage("prompt") : undefined}
          onRequestAIDraft={() => goToPrompt("idea")}
          initial={
            draft
              ? {
                  title: draft.title,
                  description: draft.description,
                  tags: draft.tags,
                  locationQuery: draft.locationQuery,
                  location: draft.location ?? null,
                }
              : null
          }
        />
      </div>
    );
  }

  return (
    <div key="thing" className="h-full w-full animate-fadeIn">
      <CardCreate
        initialDraft={draft}
        onClose={onClose}
        onBack={cameFromPrompt ? () => setStage("prompt") : undefined}
        onRequestAIDraft={() => goToPrompt("thing")}
      />
    </div>
  );
}
