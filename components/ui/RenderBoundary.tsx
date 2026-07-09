"use client";

import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { showActionError } from "@/lib/client/feedback";
import { useT } from "@/components/i18n/LocaleProvider";

function RenderFallback({
  error,
  resetErrorBoundary,
  label = "Bereich",
}: {
  error: unknown;
  resetErrorBoundary: () => void;
  label?: string;
}) {
  const t = useT();
  const message = error instanceof Error ? error.message : t.messages.unknownRenderError;

  useEffect(() => {
    showActionError(t.messages.renderFailed.replace("{label}", label), {
      description: t.messages.renderFallbackBody,
    });
  }, [label, t.messages.renderFailed, t.messages.renderFallbackBody]);

  return (
    <div className="rounded-2xl border border-red-300/20 bg-red-950/[0.08] px-4 py-4 text-white">
      <p className="text-[14px] font-semibold">{t.messages.renderFailedSentence.replace("{label}", label)}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-white/50">
        {t.messages.renderFallbackBody}
      </p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="mt-3 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/65 transition-colors hover:border-white/35 hover:text-white"
      >
        {t.common.retry}
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
