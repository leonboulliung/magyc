"use client";

import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { showActionError } from "@/lib/client/feedback";

function RenderFallback({
  error,
  resetErrorBoundary,
  label = "Bereich",
}: {
  error: unknown;
  resetErrorBoundary: () => void;
  label?: string;
}) {
  const message = error instanceof Error ? error.message : "Unbekannter Renderfehler";

  useEffect(() => {
    showActionError(`${label} konnte nicht angezeigt werden`, {
      description: "Der restliche Arbeitsbereich bleibt nutzbar.",
    });
  }, [label]);

  return (
    <div className="rounded-2xl border border-red-300/20 bg-red-950/[0.08] px-4 py-4 text-white">
      <p className="text-[14px] font-semibold">{label} konnte nicht angezeigt werden.</p>
      <p className="mt-1 text-[12px] leading-relaxed text-white/50">
        Der restliche Arbeitsbereich bleibt nutzbar. Du kannst diesen Bereich neu laden.
      </p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="mt-3 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/65 transition-colors hover:border-white/35 hover:text-white"
      >
        Erneut versuchen
      </button>
      {process.env.NODE_ENV !== "production" && (
        <pre className="mt-3 max-h-24 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-2 text-[11px] text-red-100/70">
          {message}
        </pre>
      )}
    </div>
  );
}

export function RenderBoundary({
  children,
  label,
  resetKeys,
}: {
  children: React.ReactNode;
  label?: string;
  resetKeys?: unknown[];
}) {
  return (
    <ErrorBoundary
      FallbackComponent={(props) => <RenderFallback {...props} label={label} />}
      resetKeys={resetKeys}
    >
      {children}
    </ErrorBoundary>
  );
}
