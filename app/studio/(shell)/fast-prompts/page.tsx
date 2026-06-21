"use client";

import { useState } from "react";
import { useStudioProfile } from "@/components/studio/useStudioProfile";

/**
 * Fast-Prompts — its own page. Reusable click-to-insert snippets that appear
 * under the create prompt field. Stored in settings.fastPrompts (autosaved).
 */
export default function FastPromptsPage() {
  const { profile, status, update } = useStudioProfile();
  const [input, setInput] = useState("");
  const settings = profile?.settings;

  function add() {
    const v = input.trim();
    setInput("");
    if (!v || !settings) return;
    update({ settings: { ...settings, fastPrompts: [...settings.fastPrompts, v].slice(0, 20) } });
  }
  function remove(i: number) {
    if (!settings) return;
    update({ settings: { ...settings, fastPrompts: settings.fastPrompts.filter((_, j) => j !== i) } });
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
              <div key={i} className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                <span className="mono mt-0.5 text-[12px] leading-none text-white/30">⌁</span>
                <span className="flex-1 text-[14px] leading-snug text-white/85">{fp}</span>
                <button type="button" onClick={() => remove(i)} aria-label="Entfernen" className="text-white/30 opacity-0 transition-opacity hover:text-white group-hover:opacity-100">×</button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="Baustein hinzufügen + Enter"
              maxLength={200}
              className="flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/35"
            />
            <button type="button" onClick={add} disabled={!input.trim()} className="shrink-0 rounded-xl bg-white px-4 text-[14px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-40">
              Hinzufügen
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
