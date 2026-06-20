"use client";

import { useState } from "react";
import { StudioPageHeader, SaveStatus } from "@/components/studio/StudioPageHeader";
import { useStudioProfile } from "@/components/studio/useStudioProfile";
import { Toggle } from "@/components/ui/Toggle";
import {
  LANGUAGE_OPTIONS,
  DELIVERY_FORMATS,
  EDIT_LEVELS,
  LICENSE_SCOPES,
  LICENSE_DURATIONS,
  type StudioConditions,
  type DeliveryFormat,
} from "@/lib/studioProfile";

const cardClass = "rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6";
const inputClass = "w-full rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/35";
const selectClass = "rounded-xl border border-white/12 bg-[#0c0c0c] px-3 py-2 text-[14px] text-white outline-none focus:border-white/35";
const labelClass = "mb-1.5 block text-[12px] uppercase tracking-widest text-white/40";

export default function StudioSettingsPage() {
  const { profile, status, update } = useStudioProfile();
  const [ruleInput, setRuleInput] = useState("");
  const [fpInput, setFpInput] = useState("");

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

  function addFast() {
    const v = fpInput.trim();
    setFpInput("");
    if (!v || !settings) return;
    setSettings({ fastPrompts: [...settings.fastPrompts, v].slice(0, 20) });
  }

  function removeFast(i: number) {
    if (!settings) return;
    setSettings({ fastPrompts: settings.fastPrompts.filter((_, j) => j !== i) });
  }

  const business = settings?.business;
  const conditions = settings?.conditions;

  function setBusiness(patch: Partial<NonNullable<typeof business>>) {
    if (!settings) return;
    setSettings({ business: { ...settings.business, ...patch } });
  }
  function setCond<K extends keyof StudioConditions>(group: K, patch: Partial<StudioConditions[K]>) {
    if (!settings) return;
    setSettings({ conditions: { ...settings.conditions, [group]: { ...settings.conditions[group], ...patch } } });
  }
  function toggleFormat(f: DeliveryFormat) {
    if (!conditions) return;
    const has = conditions.deliverables.formats.includes(f);
    setCond("deliverables", {
      formats: has ? conditions.deliverables.formats.filter((x) => x !== f) : [...conditions.deliverables.formats, f],
    });
  }
  function setTier(i: number, patch: Partial<{ untilDaysBefore: number; percent: number }>) {
    if (!conditions) return;
    setCond("cancellation", { tiers: conditions.cancellation.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  }
  function addTier() {
    if (!conditions) return;
    setCond("cancellation", { tiers: [...conditions.cancellation.tiers, { untilDaysBefore: 0, percent: 100 }].slice(0, 6) });
  }
  function removeTier(i: number) {
    if (!conditions) return;
    setCond("cancellation", { tiers: conditions.cancellation.tiers.filter((_, j) => j !== i) });
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

          {/* Fast-Prompts */}
          <section className={cardClass}>
            <h2 className="text-[15px] font-medium text-white">Fast-Prompts</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">
              Wiederkehrende Textbausteine, die beim Anlegen unter dem Prompt-Feld
              erscheinen und sich per Klick einfügen lassen (z. B. „Location: 92 Rue
              Victor Hugo, Ivry-sur-Seine").
            </p>

            <div className="mt-4 space-y-2">
              {settings.fastPrompts.length === 0 && (
                <p className="text-[13px] text-white/35">Noch keine Fast-Prompts.</p>
              )}
              {settings.fastPrompts.map((fp, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5"
                >
                  <span className="mono mt-0.5 text-[12px] leading-none text-white/30">⌁</span>
                  <span className="flex-1 text-[14px] leading-snug text-white/85">{fp}</span>
                  <button
                    type="button"
                    onClick={() => removeFast(i)}
                    aria-label="Fast-Prompt entfernen"
                    className="text-white/30 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={fpInput}
                onChange={(e) => setFpInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFast(); } }}
                placeholder="Baustein hinzufügen + Enter"
                maxLength={200}
                className="flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/35"
              />
              <button
                type="button"
                onClick={addFast}
                disabled={!fpInput.trim()}
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

          {/* Geschäftsdaten — Dienstleister-Daten für Verträge */}
          <section className={cardClass}>
            <h2 className="text-[15px] font-medium text-white">Geschäftsdaten</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">
              Erscheinen als Dienstleister-Daten auf jedem Vertrag.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelClass}>Geschäftsname</label>
                <input value={settings.business.legalName} onChange={(e) => setBusiness({ legalName: e.target.value })} maxLength={120} placeholder="z. B. Max Mustermann Fotografie" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Anschrift</label>
                <textarea value={settings.business.address} onChange={(e) => setBusiness({ address: e.target.value })} rows={2} maxLength={400} placeholder="Straße, PLZ Ort" className={`${inputClass} resize-none`} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>USt-IdNr.</label>
                  <input value={settings.business.vatId} onChange={(e) => setBusiness({ vatId: e.target.value })} maxLength={40} placeholder="DE…" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Steuernummer</label>
                  <input value={settings.business.taxNumber} onChange={(e) => setBusiness({ taxNumber: e.target.value })} maxLength={40} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Telefon</label>
                <input value={settings.business.phone} onChange={(e) => setBusiness({ phone: e.target.value })} maxLength={40} className={inputClass} />
              </div>
            </div>
          </section>

          {/* Vertrags-Konditionen — the studio's reusable contract DNA */}
          <section className={cardClass}>
            <h2 className="text-[15px] font-medium text-white">Vertrags-Konditionen</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">
              Einmal hinterlegen — MAGYC webt sie automatisch in jeden Vertragsentwurf.
              Einzelne Werte (Honorar, Termine) kommen je Projekt aus dem Plan.
            </p>

            {/* Leistung */}
            <div className="mt-4">
              <label className={labelClass}>Leistungsbeschreibung</label>
              <textarea value={settings.conditions.service.description} onChange={(e) => setCond("service", { description: e.target.value })} rows={2} maxLength={1000} placeholder="z. B. Hochzeitsreportage, ganztägig" className={`${inputClass} resize-none leading-relaxed`} />
            </div>

            {/* Deliverables */}
            <div className="mt-5 border-t border-white/8 pt-5">
              <label className={labelClass}>Lieferformate</label>
              <div className="flex flex-wrap gap-2">
                {DELIVERY_FORMATS.map((f) => {
                  const on = settings.conditions.deliverables.formats.includes(f);
                  return (
                    <button key={f} type="button" onClick={() => toggleFormat(f)} className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${on ? "border border-white bg-white/10 text-white" : "border border-white/12 text-white/55 hover:border-white/30 hover:text-white"}`}>
                      {f}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Bearbeitung</label>
                  <select value={settings.conditions.deliverables.editLevel} onChange={(e) => setCond("deliverables", { editLevel: e.target.value as StudioConditions["deliverables"]["editLevel"] })} className={`${selectClass} w-full`}>
                    {EDIT_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Lieferfrist</label>
                  <input value={settings.conditions.deliverables.turnaround} onChange={(e) => setCond("deliverables", { turnaround: e.target.value })} maxLength={80} placeholder="4 Wochen" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Lizenz */}
            <div className="mt-5 border-t border-white/8 pt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Lizenzumfang</label>
                  <select value={settings.conditions.license.scope} onChange={(e) => setCond("license", { scope: e.target.value as StudioConditions["license"]["scope"] })} className={`${selectClass} w-full`}>
                    {LICENSE_SCOPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Lizenzdauer</label>
                  <select value={settings.conditions.license.duration} onChange={(e) => setCond("license", { duration: e.target.value as StudioConditions["license"]["duration"] })} className={`${selectClass} w-full`}>
                    {LICENSE_DURATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <Toggle checked={settings.conditions.license.creditRequired} onChange={(v) => setCond("license", { creditRequired: v })} label="Urhebernennung verpflichtend" hint="Bei Veröffentlichung wird die Nennung als Urheber:in verlangt." />
              </div>
            </div>

            {/* Zahlung */}
            <div className="mt-5 border-t border-white/8 pt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Anzahlung (%)</label>
                  <input type="number" min={0} max={100} value={settings.conditions.payment.depositPercent} onChange={(e) => setCond("payment", { depositPercent: Number(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Zahlungsziel (Tage)</label>
                  <input type="number" min={0} max={365} value={settings.conditions.payment.paymentTermDays} onChange={(e) => setCond("payment", { paymentTermDays: Number(e.target.value) || 0 })} className={inputClass} />
                </div>
              </div>
              <div className="mt-4">
                <Toggle checked={settings.conditions.payment.kleinunternehmer19} onChange={(v) => setCond("payment", { kleinunternehmer19: v })} label="Kleinunternehmer (§19 UStG)" hint="Auf dem Vertrag wird keine Mehrwertsteuer ausgewiesen." />
              </div>
              {!settings.conditions.payment.kleinunternehmer19 && (
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-[14px] text-white">Mehrwertsteuer</span>
                  <select value={settings.conditions.payment.vatRate} onChange={(e) => setCond("payment", { vatRate: Number(e.target.value) === 7 ? 7 : 19 })} className={selectClass}>
                    <option value={19}>19 %</option>
                    <option value={7}>7 %</option>
                  </select>
                </div>
              )}
            </div>

            {/* Storno */}
            <div className="mt-5 border-t border-white/8 pt-5">
              <label className={labelClass}>Stornostaffel</label>
              <div className="space-y-2">
                {settings.conditions.cancellation.tiers.map((t, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-[13px] text-white/55">
                    <span>bis</span>
                    <input type="number" min={0} value={t.untilDaysBefore} onChange={(e) => setTier(i, { untilDaysBefore: Number(e.target.value) || 0 })} className="w-16 rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1.5 text-center text-[14px] text-white outline-none focus:border-white/35" />
                    <span>Tage vorher →</span>
                    <input type="number" min={0} max={100} value={t.percent} onChange={(e) => setTier(i, { percent: Number(e.target.value) || 0 })} className="w-16 rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1.5 text-center text-[14px] text-white outline-none focus:border-white/35" />
                    <span>%</span>
                    <button type="button" onClick={() => removeTier(i)} aria-label="Stufe entfernen" className="ml-auto text-white/30 hover:text-white">×</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addTier} className="mono mt-3 rounded-full border border-dashed border-white/20 px-3 py-1.5 text-[11px] tracking-widest text-white/60 hover:text-white">+ Stufe</button>

              <div className="mt-4">
                <label className={labelClass}>Ausfall durch Fotograf:in</label>
                <textarea value={settings.conditions.cancellation.photographerCancelClause} onChange={(e) => setCond("cancellation", { photographerCancelClause: e.target.value })} rows={2} maxLength={1000} className={`${inputClass} resize-none leading-relaxed`} />
              </div>
              <div className="mt-3">
                <label className={labelClass}>Höhere Gewalt</label>
                <textarea value={settings.conditions.cancellation.forceMajeureClause} onChange={(e) => setCond("cancellation", { forceMajeureClause: e.target.value })} rows={2} maxLength={1000} className={`${inputClass} resize-none leading-relaxed`} />
              </div>
            </div>

            {/* Datenschutz & Recht */}
            <div className="mt-5 border-t border-white/8 pt-5">
              <label className={labelClass}>Datenschutzhinweis</label>
              <textarea value={settings.conditions.privacy.dataProtectionClause} onChange={(e) => setCond("privacy", { dataProtectionClause: e.target.value })} rows={2} maxLength={2000} className={`${inputClass} resize-none leading-relaxed`} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Aufbewahrung</label>
                  <input value={settings.conditions.privacy.retention} onChange={(e) => setCond("privacy", { retention: e.target.value })} maxLength={80} placeholder="12 Monate" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>AGB-Verweis (Link/Text)</label>
                  <input value={settings.conditions.legal.agbRef} onChange={(e) => setCond("legal", { agbRef: e.target.value })} maxLength={300} placeholder="https://…/agb" className={inputClass} />
                </div>
              </div>
              <div className="mt-3">
                <label className={labelClass}>Gerichtsstand / anwendbares Recht</label>
                <input value={settings.conditions.legal.jurisdiction} onChange={(e) => setCond("legal", { jurisdiction: e.target.value })} maxLength={300} className={inputClass} />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
