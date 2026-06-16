"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Guided product builder — the click-based create path (no free prompt).
 * A few structured fields → POST /api/projects → the brief is authored by
 * the existing classifier (photo_shoot mode) → redirect into the workspace.
 */

interface Field {
  key: "client" | "product" | "goal" | "usage" | "deadline" | "references" | "scope";
  label: string;
  placeholder: string;
  hint?: string;
  area?: boolean;
}

const FIELDS: Field[] = [
  { key: "client", label: "Kunde / Marke", placeholder: "z. B. Studio Lumen, Keramik-Label" },
  { key: "product", label: "Produkt(e)", placeholder: "Was wird fotografiert?" },
  { key: "goal", label: "Ziel & Verwendung", placeholder: "Webshop, Social, Print-Kampagne …", area: true },
  { key: "usage", label: "Nutzungsrechte", placeholder: "Kanäle, Dauer", hint: "Optional" },
  { key: "deadline", label: "Termin / Deadline", placeholder: "z. B. KW 28, grob", hint: "Optional" },
  { key: "references", label: "Referenzen", placeholder: "Links zu Moodboards, Vorbildern …", hint: "Optional — Bilder später im Projekt", area: true },
  { key: "scope", label: "Umfang / Budget", placeholder: "z. B. 15 finale Bilder", hint: "Optional" },
];

type Values = Record<Field["key"], string>;

export default function NewProjectPage() {
  const router = useRouter();
  const [v, setV] = useState<Values>({
    client: "", product: "", goal: "", usage: "", deadline: "", references: "", scope: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: Field["key"], val: string) => setV((p) => ({ ...p, [k]: val }));
  const canSubmit = (v.product.trim() || v.goal.trim()) && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: "product", ...v }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.id) {
        setError(
          json?.error === "need_product_or_goal"
            ? "Bitte gib mindestens Produkt oder Ziel an."
            : "Das Projekt konnte nicht erstellt werden. Bitte erneut versuchen.",
        );
        setBusy(false);
        return;
      }
      router.push(`/studio/${json.id}`);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Neues Projekt</p>
      <h1 className="mt-3 font-brand text-[28px] font-bold tracking-[-0.02em] text-white sm:text-[40px]">
        Produkt-Briefing
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-white/60">
        Ein paar Eckdaten — MAGYC baut daraus den Brief: Referenzen, Shotlist,
        Deliverables und Freigaben. Du kannst hinterher alles anpassen.
      </p>

      <div className="mt-10 flex items-center gap-2">
        <span className="mono rounded-full bg-white/10 px-3 py-1.5 text-[11px] uppercase tracking-widest text-white">Produkt</span>
        <span className="mono text-[11px] uppercase tracking-widest text-white/30">weitere Bereiche folgen</span>
      </div>

      <div className="mt-8 space-y-5">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-2 flex items-center gap-2 text-[13px] text-white/70">
              {f.label}
              {f.hint && <span className="mono text-[10px] uppercase tracking-widest text-white/30">{f.hint}</span>}
            </label>
            {f.area ? (
              <textarea
                value={v[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
                className="w-full resize-none rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
              />
            ) : (
              <input
                value={v[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-5 text-[14px] text-red-300/90">{error}</p>}

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-full bg-white px-6 py-3 font-body text-sm font-medium text-black transition-all hover:bg-white/85 active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Brief wird erstellt …" : "Brief erstellen"}
        </button>
        <span className="mono text-[11px] uppercase tracking-widest text-white/35">dauert ein paar Sekunden</span>
      </div>
    </div>
  );
}
