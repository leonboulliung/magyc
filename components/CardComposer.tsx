"use client";

import { useState } from "react";
import { CardCreate, type CardDraft } from "./CardCreate";
import { PromptStep } from "./PromptStep";

type Stage = "prompt" | "form";

/**
 * Orchestrator for the create flow.
 *
 *   1. PROMPT — empty textarea. The user writes a sentence; the AI
 *      abstracts it into a CardDraft. They can also skip straight to
 *      a blank form.
 *   2. FORM — the structured CardCreate, optionally pre-filled.
 *
 * The agentic composer (Sequence B) will replace step 1 with a
 * primitive-grammar composition surface. For now, step 1 keeps the
 * AI-from-text entry the user expects.
 */
export function CardComposer({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("prompt");
  const [draft, setDraft] = useState<CardDraft | null>(null);

  if (stage === "prompt") {
    return (
      <div className="h-full w-full animate-fadeIn">
        <PromptStep
          onProceed={(d) => {
            setDraft(d);
            setStage("form");
          }}
          onClose={onClose}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full animate-fadeIn">
      <CardCreate
        initialDraft={draft}
        onClose={onClose}
        onBack={() => setStage("prompt")}
      />
    </div>
  );
}
