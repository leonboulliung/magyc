"use client";

import { useState } from "react";
import { StudioPageHeader, SaveStatus } from "@/components/studio/StudioPageHeader";
import { useStudioProfile } from "@/components/studio/useStudioProfile";
import { Toggle } from "@/components/ui/Toggle";
import { LANGUAGE_OPTIONS } from "@/lib/studioProfile";

const cardClass = "rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6";

export default function StudioSettingsPage() {
  const { profile, status, update } = useStudioProfile();
  const [ruleInput, setRuleInput] = useState("");

  const settings = profile?.settings;

  function setSettings(patch: Partial<NonNullable<typeof settings>>) {
    if (!profile) return;
    update({ settings: { ...profile.settings, ...patch } });
  }

  function addRule() {
    const v = ruleInput.trim();
    setRuleInput("");
    if (!v || !settings) return;
    setSettings({ rules: [...settings.rules, v].slice(0, 12) });
  }

  function removeRule(i: number) {
    if (!settings) return;
    setSettings({ rules: settings.rules.filter((_, j) => j !== i) });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <StudioPageHeader
        eyebrow="Einstellungen"
        title="Studio-Regeln & Defaults"
        description="Regeln fließen in jedes neue Projekt ein — so muss deine Arbeitsweise nicht jedes Mal neu geprompt werden. Defaults legen fest, wie neue Projekte starten."
        action={<SaveStatus status={status} />}
      />

      {!settings ? (
        <div className="mt-8 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {/* Working rules */}
          <section className={cardClass}>
            <h2 className="text-[15px] font-medium text-white">Arbeitsweise-Regeln</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">
              Kurze Vorgaben, die MAGYC bei jedem neuen Projekt berücksichtigt
              (z. B. „Nutzungsrechte immer explizit klären").
            </p>

            <div className="mt-4 space-y-2">
              {settings.rules.length === 0 && (
                <p className="text-[13px] text-white/35">Noch keine Regeln.</p>
              )}
              {settings.rules.map((rule, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5"
                >
                  <span className="mono mt-0.5 text-[11px] tabular-nums text-white/30">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-[14px] leading-snug text-white/85">{rule}</span>
                  <button
                    type="button"
                    onClick={() => removeRule(i)}
                    aria-label="Regel entfernen"
                    className="text-white/30 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={ruleInput}
                onChange={(e) => setRuleInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRule(); } }}
                placeholder="Regel hinzufügen + Enter"
                maxLength={160}
                className="flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/35"
              />
              <button
                type="button"
                onClick={addRule}
                disabled={!ruleInput.trim()}
                className="shrink-0 rounded-xl bg-white px-4 text-[14px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-40"
              >
                Hinzufügen
              </button>
            </div>
          </section>

          {/* Defaults */}
          <section className={`${cardClass} space-y-5`}>
            <h2 className="text-[15px] font-medium text-white">Defaults für neue Projekte</h2>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="block text-[14px] text-white">Sprache</span>
                <span className="mt-0.5 block text-[12.5px] text-white/45">Standardsprache, in der MAGYC plant.</span>
              </div>
              <select
                value={settings.defaultLanguage}
                onChange={(e) => setSettings({ defaultLanguage: e.target.value })}
                className="shrink-0 rounded-xl border border-white/12 bg-[#0c0c0c] px-3 py-2 text-[14px] text-white outline-none focus:border-white/35"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div className="border-t border-white/8 pt-5">
              <Toggle
                checked={settings.defaultShared}
                onChange={(v) => setSettings({ defaultShared: v })}
                label="Neue Projekte direkt teilbar"
                hint="An: neue Projekte sind sofort über den Link erreichbar. Aus: privat, bis du teilst."
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
