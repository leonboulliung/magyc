"use client";

import { useState } from "react";
import { CardCreate, type CardDraft } from "./CardCreate";
import { IdeaComposer } from "./IdeaComposer";
import { PromptStep } from "./PromptStep";

type Stage = "prompt" | "idea" | "thing";

/**
 * Orchestrator for the create flow. The AI prompt is the entry point —
 * type a sentence, the model decides idea/thing and pre-fills the form,
 * the user iterates from there. Consistent for both kinds: simple text
 * first, structured form second.
 *
 *   • PROMPT (default): one sentence + idea/thing switch. AI drafts
 *     fields, then hands off to the form for manual iteration.
 *   • IDEA / THING forms: full structured composer, opened with the
 *     AI draft pre-filled (or blank if the user skipped the draft).
 *
 * The `initialKind` prop only seeds the prompt's switch — the surface
 * itself is always the prompt first.
 */
export function CardComposer({
  onClose,
  initialKind = "idea",
}: {
  onClose: () => void;
  initialKind?: "idea" | "thing";
}) {
  const [stage, setStage] = useState<Stage>("prompt");
  const [draft, setDraft] = useState<CardDraft | null>(null);

  if (stage === "prompt") {
    return (
      <div className="h-full w-full animate-fadeIn">
        <PromptStep
          initialKind={initialKind}
          onProceed={(kind, d) => {
            setDraft(d);
            setStage(kind);
          }}
          onClose={onClose}
        />
      </div>
    );
  }

  if (stage === "idea") {
    return (
      <div key="idea" className="h-full w-full animate-fadeIn">
        <IdeaComposer
          onClose={onClose}
          onBack={() => setStage("prompt")}
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
        onBack={() => setStage("prompt")}
      />
    </div>
  );
}
