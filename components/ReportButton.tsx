"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam or promotion" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "unsafe", label: "Unsafe / dangerous" },
  { value: "impersonation", label: "Impersonation" },
  { value: "off-topic", label: "Off-topic for Paris" },
  { value: "other", label: "Other" },
];

/**
 * A small, subtle "report" link that opens a modal. Used on both cards
 * (kind="card") and profiles (kind="profile"). Sign-in is required; if
 * the viewer is signed-out, the button is hidden — they couldn't act on
 * the modal anyway.
 */
export function ReportButton({
  targetKind,
  targetId,
  ownerId,
  className,
}: {
  targetKind: "card" | "profile";
  targetId: string;
  /** When the viewer owns the target, the button is hidden. */
  ownerId: string;
  className?: string;
}) {
  const { user, isLoaded } = useUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!isLoaded || !user) return null;
  if (user.id === ownerId) return null; // hide self-report

  async function submit() {
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKind,
          targetId,
          reason,
          detail: detail.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Report failed.");
        return;
      }
      setDone(true);
      window.setTimeout(() => {
        setOpen(false);
        setDone(false);
        setReason("");
        setDetail("");
      }, 1400);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ||
          "mono text-[10px] tracking-widest opacity-50 hover:opacity-100 underline underline-offset-2"
        }
        aria-label="Report"
      >
        ⚑ REPORT
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[1300] flex items-end sm:items-center sm:justify-center sm:bg-ink/50 sm:backdrop-blur-sm sm:p-6 animate-fadeIn">
            <div className="bg-paper flex flex-col w-full sm:max-w-[520px] sm:rounded-2xl sm:border sm:border-rule sm:shadow-lg overflow-hidden">
              <div className="flex items-center justify-between border-b border-rule px-4 sm:px-6 py-3 sm:py-4 safe-top">
                <div className="mono text-[10px] tracking-widest opacity-70">
                  REPORT · {targetKind.toUpperCase()}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="mono text-[11px] tracking-widest hover:underline"
                  disabled={submitting}
                >
                  CLOSE ✕
                </button>
              </div>
              <div className="px-4 sm:px-6 py-5 space-y-4">
                {done ? (
                  <p className="mono text-[12px] py-6 text-center">
                    ✓ Reported. Thank you — we&rsquo;ll look at it.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="mono text-[10px] tracking-widest opacity-70">
                        REASON
                      </label>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {REASONS.map((r) => (
                          <button
                            key={r.value}
                            onClick={() => setReason(r.value)}
                            className={`mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border transition-colors ${
                              reason === r.value
                                ? "bg-ink text-paper border-ink"
                                : "bg-paper text-ink border-rule-strong hover:bg-ink hover:text-paper"
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mono text-[10px] tracking-widest opacity-70">
                        DETAIL (OPTIONAL)
                      </label>
                      <textarea
                        value={detail}
                        onChange={(e) => setDetail(e.target.value.slice(0, 500))}
                        rows={3}
                        placeholder="Anything that helps us decide…"
                        className="input mt-1 resize-none"
                      />
                      <div className="mono text-[10px] opacity-50 mt-1 text-right">
                        {detail.length}/500
                      </div>
                    </div>
                    {error && (
                      <p className="mono text-[11px] text-red-700">
                        {error.toUpperCase()}
                      </p>
                    )}
                  </>
                )}
              </div>
              {!done && (
                <div className="border-t border-rule px-4 sm:px-6 py-3 flex justify-end gap-2 safe-bottom">
                  <button
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="btn ghost"
                  >
                    Cancel
                  </button>
                  <button onClick={submit} disabled={submitting} className="btn">
                    {submitting ? "Sending…" : "Send report"}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
