"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useStudioProfile } from "@/components/studio/useStudioProfile";
import { Popover } from "@/components/ui/Popover";
import { FAST_PROMPT_COLORS, type FastPrompt } from "@/lib/studioProfile";
import { useT } from "@/components/i18n/LocaleProvider";

/**
 * Schnellbausteine — its own page. Reusable click-to-insert snippets that appear
 * under the create prompt field. Each can carry an optional colour tint for
 * quick scanning. Stored in settings.fastPrompts (autosaved).
 */
export default function FastPromptsPage() {
  const t = useT();
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
          <h1 className="font-brand text-[26px] font-bold tracking-[-0.02em] text-[#17171a] sm:text-[32px]">{t.studio.fastPromptsPage.title}</h1>
        </div>
        <span className="mono mt-2 text-[11px] tracking-widest text-black/35">
          {status === "loading" ? t.studio.saveStatusLoading : status === "saving" ? t.studio.saveStatusSaving : status === "error" ? t.studio.saveStatusError : t.studio.saveStatusSaved}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-black/55">
        {t.studio.fastPromptsPage.intro}
      </p>

      {!settings ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : (
        <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
          <div className="space-y-2">
            {settings.fastPrompts.length === 0 && (
              <p className="text-[13px] text-black/35">{t.studio.fastPromptsPage.empty}</p>
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
                <button type="button" onClick={() => remove(i)} aria-label={t.common.remove} className="text-black/30 opacity-0 transition-opacity hover:text-[#17171a] group-hover:opacity-100">×</button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder={t.studio.fastPromptsPage.addPlaceholder}
              maxLength={200}
              className="min-w-[180px] flex-1 rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-[14px] text-[#17171a] outline-none placeholder:text-black/30 focus:border-black/35"
            />
            <ColorSelect value={color} onPick={setColor} showLabel />
            <button type="button" onClick={add} disabled={!input.trim()} className="shrink-0 rounded-xl bg-[#17171a] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40">
              {t.common.add}
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
  const t = useT();
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
        background: "var(--studio-surface)",
        border: "1px solid var(--studio-rule)",
        borderRadius: 16,
        color: "var(--studio-ink)",
      }}
      trigger={
        <button
          type="button"
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-black/12 bg-white text-[12px] text-black/55 transition-colors hover:border-black/25 hover:text-black ${showLabel ? "px-3" : "w-9"}`}
          aria-label={t.studio.fastPromptsPage.colorAria}
        >
          <span
            className="h-3.5 w-3.5 rounded-full border border-black/15"
            style={{ background: value ?? "transparent" }}
          />
          {showLabel && <span>{value ? t.studio.fastPromptsPage.color : t.studio.fastPromptsPage.noColor}</span>}
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
          {t.studio.fastPromptsPage.noColor}
        </button>
        <div className="mt-1 grid grid-cols-4 gap-1 p-1">
          {FAST_PROMPT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => choose(c)}
              aria-label={t.studio.fastPromptsPage.colorLabel.replace("{color}", c)}
              className="grid h-10 place-items-center rounded-xl transition-colors hover:bg-black/[0.04]"
            >
              <span
                className="h-6 w-6 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.14)]"
                style={{ background: c, outline: value === c ? "2px solid var(--studio-ink)" : "none", outlineOffset: 2 }}
              />
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}
