"use client";

import { useStudioProfile } from "@/components/studio/useStudioProfile";
import {
  DELIVERY_FORMATS, EDIT_LEVELS, LICENSE_SCOPES, LICENSE_DURATIONS,
  type StudioBusiness, type StudioConditions, type DeliveryFormat,
} from "@/lib/studioProfile";
import {
  PageHeader, Card, Field, Input, Textarea, Toggle, Chips, Segmented,
} from "@/components/studio/formKit";

/**
 * Vertragsinhalte — the studio's reusable contract "DNA": legal/business data
 * plus the standing conditions (Leistung, Lieferung, Nutzungsrechte, Zahlung,
 * Storno, Datenschutz) that feed every contract draft. Stored in
 * settings.business + settings.conditions, autosaved via useStudioProfile.
 */
export default function VertragsinhaltePage() {
  const { profile, status, update } = useStudioProfile();
  const settings = profile?.settings;

  const setBiz = (patch: Partial<StudioBusiness>) => {
    if (!settings) return;
    update({ settings: { ...settings, business: { ...settings.business, ...patch } } });
  };
  const setCond = <K extends keyof StudioConditions>(key: K, patch: Partial<StudioConditions[K]>) => {
    if (!settings) return;
    update({ settings: { ...settings, conditions: { ...settings.conditions, [key]: { ...settings.conditions[key], ...patch } } } });
  };

  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <PageHeader eyebrow="Studio · Vertragsinhalte" title="Vertragsinhalte" status={status}>
        Einmal hinterlegt, fließen diese Angaben automatisch in jeden Vertragsentwurf —
        Geschäftsdaten, Leistung & Lieferung, Nutzungsrechte, Zahlung, Storno und
        Datenschutz.
      </PageHeader>

      {!settings ? (
        <div className="mt-8 h-96 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : (
        <div className="mt-8 space-y-5">
          {/* Geschäftsdaten */}
          <Card title="Geschäftsdaten" hint="Deine Identität als Dienstleister auf dem Vertrag.">
            <div className="space-y-4">
              <Field label="Rechtlicher Name / Firma">
                <Input value={settings.business.legalName} onChange={(e) => setBiz({ legalName: e.target.value })} placeholder="z. B. Studio Lumen, Inh. Mara Klein" maxLength={120} />
              </Field>
              <Field label="Anschrift">
                <Textarea value={settings.business.address} onChange={(e) => setBiz({ address: e.target.value })} rows={2} placeholder="Straße, PLZ Ort" maxLength={400} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="USt-IdNr."><Input value={settings.business.vatId} onChange={(e) => setBiz({ vatId: e.target.value })} placeholder="DE…" maxLength={40} /></Field>
                <Field label="Steuernummer"><Input value={settings.business.taxNumber} onChange={(e) => setBiz({ taxNumber: e.target.value })} maxLength={40} /></Field>
              </div>
              <Field label="Telefon"><Input value={settings.business.phone} onChange={(e) => setBiz({ phone: e.target.value })} maxLength={40} /></Field>
            </div>
          </Card>

          {/* Leistung */}
          <Card title="Leistung" hint="Was du standardmäßig erbringst — wird pro Projekt verfeinert.">
            <Field label="Leistungsbeschreibung">
              <Textarea value={settings.conditions.service.description} onChange={(e) => setCond("service", { description: e.target.value })} rows={3} placeholder="z. B. Fotografische Begleitung inkl. Vor- und Nachbereitung." maxLength={1000} />
            </Field>
          </Card>

          {/* Lieferung */}
          <Card title="Lieferung">
            <div className="space-y-5">
              <Field label="Lieferformate">
                <div className="mt-1.5">
                  <Chips
                    options={DELIVERY_FORMATS.map((f) => ({ value: f, label: f }))}
                    selected={settings.conditions.deliverables.formats}
                    onToggle={(v: DeliveryFormat) => {
                      const cur = settings.conditions.deliverables.formats;
                      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
                      setCond("deliverables", { formats: next.length ? next : cur });
                    }}
                  />
                </div>
              </Field>
              <Field label="Bearbeitungsgrad">
                <div className="mt-1.5"><Segmented options={EDIT_LEVELS} value={settings.conditions.deliverables.editLevel} onChange={(v) => setCond("deliverables", { editLevel: v })} /></div>
              </Field>
              <Field label="Lieferzeit"><Input value={settings.conditions.deliverables.turnaround} onChange={(e) => setCond("deliverables", { turnaround: e.target.value })} placeholder="z. B. 4 Wochen" maxLength={80} /></Field>
            </div>
          </Card>

          {/* Nutzungsrechte */}
          <Card title="Nutzungsrechte">
            <div className="space-y-5">
              <Field label="Umfang">
                <div className="mt-1.5"><Segmented options={LICENSE_SCOPES} value={settings.conditions.license.scope} onChange={(v) => setCond("license", { scope: v })} /></div>
              </Field>
              <Field label="Dauer">
                <div className="mt-1.5"><Segmented options={LICENSE_DURATIONS} value={settings.conditions.license.duration} onChange={(v) => setCond("license", { duration: v })} /></div>
              </Field>
              <div className="h-px bg-white/8" />
              <Toggle checked={settings.conditions.license.creditRequired} onChange={(v) => setCond("license", { creditRequired: v })} label="Namensnennung erforderlich" hint="Der Kunde nennt dich bei Veröffentlichung als Urheber:in." />
            </div>
          </Card>

          {/* Zahlung */}
          <Card title="Zahlung">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Anzahlung (%)"><Input type="number" min={0} max={100} value={settings.conditions.payment.depositPercent} onChange={(e) => setCond("payment", { depositPercent: Math.min(100, num(e.target.value)) })} /></Field>
                <Field label="Zahlungsziel (Tage)"><Input type="number" min={0} max={365} value={settings.conditions.payment.paymentTermDays} onChange={(e) => setCond("payment", { paymentTermDays: Math.min(365, num(e.target.value)) })} /></Field>
              </div>
              <Field label="Umsatzsteuersatz">
                <div className="mt-1.5"><Segmented options={[{ value: "19", label: "19 %" }, { value: "7", label: "7 %" }]} value={String(settings.conditions.payment.vatRate)} onChange={(v) => setCond("payment", { vatRate: v === "7" ? 7 : 19 })} /></div>
              </Field>
              <div className="h-px bg-white/8" />
              <Toggle checked={settings.conditions.payment.kleinunternehmer19} onChange={(v) => setCond("payment", { kleinunternehmer19: v })} label="Kleinunternehmer (§19 UStG)" hint="Keine Umsatzsteuer ausweisen." />
            </div>
          </Card>

          {/* Storno */}
          <Card title="Storno & höhere Gewalt">
            <div className="space-y-4">
              <Field label="Stornostaffel" hint="Ab wie vielen Tagen vor dem Termin welcher Anteil fällig wird.">
                <div className="mt-2 space-y-2">
                  {settings.conditions.cancellation.tiers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="text-[13px] text-black/45">bis</span>
                      <input type="number" min={0} value={t.untilDaysBefore} onChange={(e) => {
                        const tiers = settings.conditions.cancellation.tiers.map((x, j) => j === i ? { ...x, untilDaysBefore: num(e.target.value) } : x);
                        setCond("cancellation", { tiers });
                      }} className="w-20 rounded-lg border border-black/12 bg-white px-2.5 py-1.5 text-[14px] text-[#17171a] outline-none focus:border-black/35" />
                      <span className="text-[13px] text-black/45">Tage vorher →</span>
                      <input type="number" min={0} max={100} value={t.percent} onChange={(e) => {
                        const tiers = settings.conditions.cancellation.tiers.map((x, j) => j === i ? { ...x, percent: Math.min(100, num(e.target.value)) } : x);
                        setCond("cancellation", { tiers });
                      }} className="w-20 rounded-lg border border-black/12 bg-white px-2.5 py-1.5 text-[14px] text-[#17171a] outline-none focus:border-black/35" />
                      <span className="text-[13px] text-black/45">%</span>
                      <button type="button" onClick={() => setCond("cancellation", { tiers: settings.conditions.cancellation.tiers.filter((_, j) => j !== i) })} aria-label="Stufe entfernen" className="ml-auto text-black/30 transition-colors hover:text-[#17171a]">×</button>
                    </div>
                  ))}
                  {settings.conditions.cancellation.tiers.length < 6 && (
                    <button type="button" onClick={() => setCond("cancellation", { tiers: [...settings.conditions.cancellation.tiers, { untilDaysBefore: 0, percent: 100 }] })} className="mono text-[12px] tracking-widest text-black/45 transition-colors hover:text-[#17171a]">+ Stufe</button>
                  )}
                </div>
              </Field>
              <Field label="Ausfall durch dich"><Textarea value={settings.conditions.cancellation.photographerCancelClause} onChange={(e) => setCond("cancellation", { photographerCancelClause: e.target.value })} rows={2} maxLength={1000} /></Field>
              <Field label="Höhere Gewalt"><Textarea value={settings.conditions.cancellation.forceMajeureClause} onChange={(e) => setCond("cancellation", { forceMajeureClause: e.target.value })} rows={2} maxLength={1000} /></Field>
            </div>
          </Card>

          {/* Datenschutz */}
          <Card title="Datenschutz">
            <div className="space-y-4">
              <Field label="Datenschutzklausel"><Textarea value={settings.conditions.privacy.dataProtectionClause} onChange={(e) => setCond("privacy", { dataProtectionClause: e.target.value })} rows={3} maxLength={2000} /></Field>
              <Field label="Speicherdauer"><Input value={settings.conditions.privacy.retention} onChange={(e) => setCond("privacy", { retention: e.target.value })} placeholder="z. B. 12 Monate" maxLength={80} /></Field>
            </div>
          </Card>

          {/* Rechtliches */}
          <Card title="Rechtliches">
            <div className="space-y-4">
              <Field label="AGB-Verweis" hint="Link oder Verweis auf deine vollständigen AGB."><Input value={settings.conditions.legal.agbRef} onChange={(e) => setCond("legal", { agbRef: e.target.value })} maxLength={300} /></Field>
              <Field label="Gerichtsstand / anwendbares Recht"><Textarea value={settings.conditions.legal.jurisdiction} onChange={(e) => setCond("legal", { jurisdiction: e.target.value })} rows={2} maxLength={300} /></Field>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
