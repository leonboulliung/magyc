"use client";

import { useState } from "react";
import { useStudioProfile } from "@/components/studio/useStudioProfile";
import { FAST_PROMPT_COLORS, type FastPrompt } from "@/lib/studioProfile";

/**
 * Fast-Prompts — its own page. Reusable click-to-insert snippets that appear
 * under the create prompt field. Each can carry an optional colour tint for
 * quick scanning. Stored in settings.fastPrompts (autosaved).
 */
export default function FastPromptsPage() {
  const { profile, status, update } = useStudioProfile();
  const [input, setInput] = useState("");
  const [color, setColor] = useState<string | undefined>(undefined);
  const settings = profile?.settings;

  function commit(next: FastPrompt[]) {
    if (!settings) return;
    update({ settings: { ...settings, fastPrompts: next.slice(0, 20) } });
  }
  function add() {
    const v = input.trim();
    setInput("");
    if (!v || !settings) return;
    commit([...settings.fastPrompts, color ? { text: v, color } : { text: v }]);
  }
  function remove(i: number) {
    if (!settings) return;
    commit(settings.fastPrompts.filter((_, j) => j !== i));
  }
  function recolor(i: number, c: string | undefined) {
    if (!settings) return;
    commit(settings.fastPrompts.map((fp, j) => (j === i ? (c ? { ...fp, color: c } : { text: fp.text }) : fp)));
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Studio · Fast-Prompts</p>
          <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-white sm:text-[32px]">Fast-Prompts</h1>
        </div>
        <span className="mono mt-2 text-[11px] tracking-widest text-white/35">
          {status === "loading" ? "Lädt …" : status === "saving" ? "Speichert …" : status === "error" ? "Nicht gespeichert" : "✓ Gespeichert"}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/55">
        Wiederkehrende Textbausteine, die beim Anlegen unter dem Prompt-Feld erscheinen
        und sich per Klick einfügen lassen — z. B. „Location: 92 Rue Victor Hugo, Ivry-sur-Seine".
        Optional einfärbbar.
      </p>

      {!settings ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : (
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
          <div className="space-y-2">
            {settings.fastPrompts.length === 0 && (
              <p className="text-[13px] text-white/35">Noch keine Fast-Prompts.</p>
            )}
            {settings.fastPrompts.map((fp, i) => (
              <div
                key={i}
                className="group flex items-center gap-3 rounded-xl border bg-white/[0.02] px-3.5 py-2.5"
                style={{ borderColor: fp.color ? `${fp.color}66` : "rgba(255,255,255,0.10)" }}
              >
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fp.color ?? "rgba(255,255,255,0.25)" }} />
                <span className="flex-1 text-[14px] leading-snug text-white/85">{fp.text}</span>
                <Swatches value={fp.color} onPick={(c) => recolor(i, c)} />
                <button type="button" onClick={() => remove(i)} aria-label="Entfernen" className="text-white/30 opacity-0 transition-opacity hover:text-white group-hover:opacity-100">×</button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="Baustein hinzufügen + Enter"
              maxLength={200}
              className="min-w-[180px] flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/35"
            />
            <Swatches value={color} onPick={setColor} />
            <button type="button" onClick={add} disabled={!input.trim()} className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-40">
              Hinzufügen
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** A compact row of colour swatches + a "no colour" option. */
function Swatches({ value, onPick }: { value: string | undefined; onPick: (c: string | undefined) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onPick(undefined)}
        aria-label="Keine Farbe"
        className="h-5 w-5 rounded-full border border-white/20 text-[10px] leading-none text-white/40"
        style={{ outline: value === undefined ? "2px solid rgba(255,255,255,0.6)" : "none", outlineOffset: 1 }}
      >
        ×
      </button>
      {FAST_PROMPT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          aria-label={`Farbe ${c}`}
          className="h-5 w-5 rounded-full"
          style={{ background: c, outline: value === c ? "2px solid rgba(255,255,255,0.7)" : "none", outlineOffset: 1 }}
        />
      ))}
    </div>
  );
}
