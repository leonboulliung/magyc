"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import {
  readApiJson,
  showActionError,
  showActionSuccess,
  showApiError,
  showUnknownError,
} from "@/lib/client/feedback";

/**
 * ShareDialog — turn unlisted sharing on/off for a suite project and copy
 * the link. While off, the project is private (owner-only). While on,
 * anyone with the /s/[id] link can view and collaborate (structural edits
 * stay owner-only). Used from the dashboard card menu and the project bar.
 */
export function ShareDialog({
  id,
  initialShared,
  open,
  onOpenChange,
}: {
  id: string;
  initialShared: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [shared, setShared] = useState(initialShared);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined" ? `${window.location.origin}/s/${id}` : `/s/${id}`;

  useEffect(() => {
    setShared(initialShared);
  }, [initialShared, open]);

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    const prev = shared;
    setShared(next); // optimistic
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared: next }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        setShared(prev);
        showApiError(next ? "Teilen fehlgeschlagen" : "Privat-Schalten fehlgeschlagen", json, {
          fallback: next
            ? "Der Projektlink konnte gerade nicht aktiviert werden."
            : "Das Projekt konnte gerade nicht privat geschaltet werden.",
        });
      } else {
        showActionSuccess(next ? "Projektlink aktiviert" : "Projekt ist privat");
        router.refresh();
      }
    } catch (error) {
      setShared(prev);
      showUnknownError(next ? "Teilen fehlgeschlagen" : "Privat-Schalten fehlgeschlagen", error, {
        fallback: next
          ? "Der Projektlink konnte gerade nicht aktiviert werden."
          : "Das Projekt konnte gerade nicht privat geschaltet werden.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showActionSuccess("Link kopiert");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showActionError("Kopieren nicht möglich", {
        description: "Der Link wird deshalb zum manuellen Kopieren angezeigt.",
      });
      window.prompt("Link", link);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Projekt teilen" maxWidth={460}>
      <div className="rounded-2xl border border-black/12 bg-[#0c0c0c] p-6 text-[#17171a] shadow-2xl">
        <h2 className="font-brand text-[20px] font-bold tracking-[-0.01em]">Projekt teilen</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-black/60">
          Wer den Link hat, kann das Projekt sehen und mitarbeiten (kommentieren, abstimmen,
          hochladen). Struktur ändern kannst nur du.
        </p>

        <button
          type="button"
          onClick={() => toggle(!shared)}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-between rounded-xl border border-black/12 bg-white px-4 py-3 text-left transition-colors hover:border-black/25 disabled:opacity-60"
        >
          <span>
            <span className="block text-[15px] font-medium text-white">
              {shared ? "Geteilt" : "Privat"}
            </span>
            <span className="block text-[13px] text-black/55">
              {shared ? "Über den Link erreichbar" : "Nur für dich sichtbar"}
            </span>
          </span>
          {/* toggle pill */}
          <span
            className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
            style={{ background: shared ? "#fff" : "rgba(255,255,255,0.18)" }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
              style={{ left: shared ? 22 : 2, background: shared ? "#000" : "#fff" }}
            />
          </span>
        </button>

        {shared && (
          <div className="mt-4">
            <div className="mono mb-1.5 text-[10px] uppercase tracking-widest text-black/40">Link</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-xl border border-black/12 bg-white px-3 py-2.5 text-[13px] text-black/80 outline-none"
              />
              <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-xl bg-[#17171a] px-4 py-2.5 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
              >
                {copied ? "Kopiert ✓" : "Kopieren"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mono text-[12px] uppercase tracking-widest text-black/55 hover:text-[#17171a]"
          >
            Schließen
          </button>
        </div>
      </div>
    </Dialog>
  );
}
