"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Guided product builder — prompt-first (like the demo): a central prompt
 * field + quick-selects for fast generation. Optional structured "Eckdaten"
 * sit behind a toggle. Creating with NOTHING is allowed — you get a starter
 * product project. Either way the brief is authored by the classifier and
 * you land in the workspace.
 */

const QUICK: string[] = [
  "Produkt-Stillleben für einen Webshop.",
  "Beauty-/Skincare-Shooting, clean auf Weiß.",
  "Editorial-Produktstrecke mit Moodboard.",
  "Packshots in mehreren Formaten für Social.",
];

interface Field {
  key: "client" | "product" | "goal" | "usage" | "deadline" | "references" | "scope";
  label: string;
  placeholder: string;
  area?: boolean;
}
const FIELDS: Field[] = [
  { key: "client", label: "Kunde / Marke", placeholder: "z. B. Studio Lumen" },
  { key: "product", label: "Produkt(e)", placeholder: "Was wird fotografiert?" },
  { key: "goal", label: "Ziel & Verwendung", placeholder: "Webshop, Social, Print …", area: true },
  { key: "usage", label: "Nutzungsrechte", placeholder: "Kanäle, Dauer" },
  { key: "deadline", label: "Termin / Deadline", placeholder: "z. B. KW 28" },
  { key: "references", label: "Referenzen", placeholder: "Links zu Moodboards, Vorbildern …", area: true },
  { key: "scope", label: "Umfang / Budget", placeholder: "z. B. 15 finale Bilder" },
];
type Values = Record<Field["key"], string>;

export default function NewProjectPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [showFields, setShowFields] = useState(false);
  const [v, setV] = useState<Values>({
    client: "", product: "", goal: "", usage: "", deadline: "", references: "", scope: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: Field["key"], val: string) => setV((p) => ({ ...p, [k]: val }));

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: "product", prompt, ...(showFields ? v : {}) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.id) {
        setError("Das Projekt konnte nicht erstellt werden. Bitte erneut versuchen.");
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
        Produkt-Projekt
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-white/60">
        Beschreib das Shooting in einem Satz — oder leg einfach leer los. MAGYC baut den
        Brief (Referenzen, Shotlist, Deliverables, Freigaben), den du danach anpasst.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="z. B. Produktshooting für eine handgemachte Keramik-Serie, clean und warm …"
        rows={4}
        autoFocus
        className="mt-8 w-full resize-none rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-4 text-[17px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setPrompt(q)}
            className="rounded-full border border-white/12 px-3 py-1.5 text-left text-[13px] text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            {q}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowFields((s) => !s)}
        className="mono mt-6 text-[11px] uppercase tracking-widest text-white/45 hover:text-white/80"
      >
        {showFields ? "Eckdaten ausblenden" : "Eckdaten hinzufügen (optional)"}
      </button>

      {showFields && (
        <div className="mt-5 space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-[13px] text-white/70">{f.label}</label>
              {f.area ? (
                <textarea
                  value={v[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
                />
              ) : (
                <input
                  value={v[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-5 text-[14px] text-red-300/90">{error}</p>}

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-full bg-white px-6 py-3 font-body text-sm font-medium text-black transition-all hover:bg-white/85 active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Projekt wird erstellt …" : "Projekt erstellen"}
        </button>
        <span className="mono text-[11px] uppercase tracking-widest text-white/35">dauert ein paar Sekunden</span>
      </div>
    </div>
  );
}
