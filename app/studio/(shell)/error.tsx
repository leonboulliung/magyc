"use client";

import { useEffect } from "react";
import { useT } from "@/components/i18n/LocaleProvider";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error("[studio] render failed", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-6xl items-center px-4 py-16 sm:px-8">
      <div className="max-w-xl">
        <h1 className="text-3xl font-semibold">{t.messages.studioOpenFailed}</h1>
        <p className="mt-4 text-[15px] leading-relaxed opacity-60">
          {t.messages.studioOpenFailedBody}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex min-h-10 items-center rounded-full border border-current/20 px-5 text-sm font-medium transition-opacity hover:opacity-65"
        >
          {t.common.retry}
        </button>
      </div>
    </main>
  );
}
