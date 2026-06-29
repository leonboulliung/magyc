"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Icon } from "@iconify/react";
import { readApiJson, showActionSuccess, showApiError, showUnknownError } from "@/lib/client/feedback";
import { supportTypeLabel, type SupportType } from "@/lib/adminAccount";

const TYPES: SupportType[] = ["problem", "question", "wish", "other"];

export function SupportWidget({
  spaceId,
  variant = "project",
}: {
  spaceId?: string | null;
  variant?: "studio" | "project";
}) {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SupportType>("problem");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = useMemo(() => message.trim().length >= 10 && !busy, [busy, message]);

  if (!isSignedIn) return null;

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message,
          route: typeof window !== "undefined" ? window.location.pathname + window.location.search : "",
          spaceId: spaceId || undefined,
          metadata: {
            viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
          },
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        showApiError("Support-Anfrage nicht gesendet", json);
        return;
      }
      setMessage("");
      setOpen(false);
      showActionSuccess("Support-Anfrage gesendet", {
        description: "Sie ist jetzt im Admin-Bereich sichtbar.",
      });
    } catch (error) {
      showUnknownError("Support-Anfrage nicht gesendet", error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Support"
        aria-label="Support öffnen"
        className={variant === "studio"
          ? "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 text-black/45 transition-colors hover:border-black/25 hover:bg-black/[0.04] hover:text-black"
          : "fixed bottom-4 left-4 z-40 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/80 text-white/60 transition-colors hover:border-white/30 hover:bg-black hover:text-white"}
      >
        <Icon icon="lucide:circle-help" className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4">
          <section className="w-full max-w-lg rounded-[28px] border border-black/10 bg-[#f4f4f1] p-5 text-[#17171a] shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono text-[11px] uppercase tracking-[0.28em] text-black/45">Support</p>
                <h2 className="mt-2 text-2xl font-semibold">Was hakt gerade?</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-black/55">
                  Schick kurz ab, was passiert ist. Ich sehe es im Admin und melde mich manuell per Mail.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/15 text-black/55 transition-colors hover:bg-black/[0.05] hover:text-black"
                aria-label="Support schließen"
              >
                <Icon icon="lucide:x" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setType(item)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    type === item
                      ? "border-[#17171a] bg-[#17171a] text-white"
                      : "border-black/15 bg-white/60 text-black/60 hover:border-black/30 hover:bg-white hover:text-black"
                  }`}
                >
                  {supportTypeLabel(item)}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              className="mt-4 w-full resize-none rounded-[22px] border border-black/15 bg-white/70 p-4 text-base outline-none transition placeholder:text-black/35 focus:border-black/35"
              placeholder="Beschreibe kurz den Fehler, die Frage oder den Wunsch."
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-black/45">{message.trim().length}/4000</p>
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#17171a] px-5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon icon="lucide:send" className="h-4 w-4" />
                Senden
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
