"use client";

import { useEffect } from "react";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[studio] render failed", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-6xl items-center px-4 py-16 sm:px-8">
      <div className="max-w-xl">
        <p className="mono text-[10px] uppercase tracking-[0.2em] opacity-45">Studio</p>
        <h1 className="mt-3 text-3xl font-semibold">Das Studio konnte gerade nicht geöffnet werden.</h1>
        <p className="mt-4 text-[15px] leading-relaxed opacity-60">
          Deine Projekte sind nicht betroffen. Versuche es bitte noch einmal.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex min-h-10 items-center rounded-full border border-current/20 px-5 text-sm font-medium transition-opacity hover:opacity-65"
        >
          Erneut versuchen
        </button>
      </div>
    </main>
  );
}
