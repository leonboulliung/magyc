"use client";

import { CardCreate } from "./CardCreate";

/**
 * Composer orchestrator. The old kind-toggle + AI prompt step is
 * paused while we move to the agentic composer (Sequence B). For now
 * the create flow is the structured form directly — the empty-text
 * → AI structuring path will come back in agentic form.
 */
export function CardComposer({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full w-full animate-fadeIn">
      <CardCreate onClose={onClose} />
    </div>
  );
}
