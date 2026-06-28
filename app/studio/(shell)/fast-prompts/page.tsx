"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useStudioProfile } from "@/components/studio/useStudioProfile";
import { Popover } from "@/components/ui/Popover";
import { FAST_PROMPT_COLORS, type FastPrompt } from "@/lib/studioProfile";

/**
 * Schnellbausteine — its own page. Reusable click-to-insert snippets that appear
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
          <p className="mono text-[11px] uppercase tracking-[0.22em] text-black/45">Studio · Schnellbausteine</p>
          <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-[#17171a] sm:text-[32px]">Schnellbausteine</h1>
        </div>
        <span className="mono mt-2 text-[11px] tracking-widest text-black/35">
          {status === "loading" ? "Lädt …" : status === "saving" ? "Speichert …" : status === "error" ? "Nicht gespeichert" : "✓ Gespeichert"}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-black/55">
        Wiederkehrende Textbausteine, die beim Anlegen unter dem Prompt-Feld erscheinen
        und sich per Klick einfügen lassen — z. B. „Location: 92 Rue Victor Hugo, Ivry-sur-Seine".
        Optional einfärbbar.
      </p>

      {!settings ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : (
        <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
          <div className="space-y-2">
            {settings.fastPrompts.length === 0 && (
              <p className="text-[13px] text-black/35">Noch keine Schnellbausteine.</p>
            )}
            {settings.fastPrompts.map((fp, i) => (
              <div
                key={i}
                className="group flex items-center gap-3 rounded-xl border bg-white px-3.5 py-2.5"
                style={{ borderColor: fp.color ? `${fp.color}66` : "rgba(0,0,0,0.12)" }}
              >
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fp.color ?? "rgba(0,0,0,0.28)" }} />
                <span className="flex-1 text-[14px] leading-snug text-black/85">{fp.text}</span>
                <ColorSelect value={fp.color} onPick={(c) => recolor(i, c)} />
                <button type="button" onClick={() => remove(i)} aria-label="Entfernen" className="text-black/30 opacity-0 transition-opacity hover:text-[#17171a] group-hover:opacity-100">×</button>
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
              className="min-w-[180px] flex-1 rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-[14px] text-[#17171a] outline-none placeholder:text-black/30 focus:border-black/35"
            />
            <ColorSelect value={color} onPick={setColor} showLabel />
            <button type="button" onClick={add} disabled={!input.trim()} className="shrink-0 rounded-xl bg-[#17171a] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40">
              Hinzufügen
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** A single quiet trigger; the palette only appears when colour is relevant. */
function ColorSelect({
  value,
  onPick,
  showLabel = false,
}: {
  value: string | undefined;
  onPick: (c: string | undefined) => void;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const choose = (next: string | undefined) => {
    onPick(next);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      side="bottom"
      width={210}
      contentStyle={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 16,
        color: "#17171a",
      }}
      trigger={
        <button
          type="button"
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-black/12 bg-white text-[12px] text-black/55 transition-colors hover:border-black/25 hover:text-black ${showLabel ? "px-3" : "w-9"}`}
          aria-label="Farbe auswählen"
        >
          <span
            className="h-3.5 w-3.5 rounded-full border border-black/15"
            style={{ background: value ?? "transparent" }}
          />
          {showLabel && <span>{value ? "Farbe" : "Keine Farbe"}</span>}
          {showLabel && <Icon icon="lucide:chevron-down" className="h-3.5 w-3.5" />}
        </button>
      }
    >
      <div className="p-2">
        <button
          type="button"
          onClick={() => choose(undefined)}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-black/[0.04] ${value === undefined ? "bg-black/[0.05] text-black" : "text-black/60"}`}
        >
          <span className="grid h-5 w-5 place-items-center rounded-full border border-black/20 bg-white">
            <Icon icon="lucide:minus" className="h-3 w-3 text-black/40" />
          </span>
          Keine Farbe
        </button>
        <div className="mt-1 grid grid-cols-4 gap-1 p-1">
          {FAST_PROMPT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => choose(c)}
              aria-label={`Farbe ${c}`}
              className="grid h-10 place-items-center rounded-xl transition-colors hover:bg-black/[0.04]"
            >
              <span
                className="h-6 w-6 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.14)]"
                style={{ background: c, outline: value === c ? "2px solid #17171a" : "none", outlineOffset: 2 }}
              />
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}
