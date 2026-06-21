"use client";

import Link from "next/link";
import { useStudioProfile } from "@/components/studio/useStudioProfile";
import { LANGUAGE_OPTIONS } from "@/lib/studioProfile";
import { PageHeader, Card, Field, Select, Toggle, TagEditor } from "@/components/studio/formKit";

/**
 * Einstellungen — account-wide defaults for new projects (language, sharing)
 * plus the working-style "rules" woven into every new brief. Contract content
 * lives on its own Vertragsinhalte page; Fast-Prompts on theirs.
 */
export default function StudioSettingsPage() {
  const { profile, status, update } = useStudioProfile();
  const settings = profile?.settings;
  const set = (patch: Partial<NonNullable<typeof settings>>) => {
    if (!settings) return;
    update({ settings: { ...settings, ...patch } });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <PageHeader eyebrow="Studio · Einstellungen" title="Einstellungen" status={status}>
        Standards für neue Projekte und deine Arbeitsweise. Konditionen für Verträge
        pflegst du unter Vertragsinhalte.
      </PageHeader>

      {!settings ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : (
        <div className="mt-8 space-y-5">
          <Card title="Neue Projekte">
            <div className="space-y-5">
              <Field label="Standardsprache" hint="In dieser Sprache werden neue Briefings erzeugt.">
                <Select
                  value={settings.defaultLanguage}
                  onChange={(e) => set({ defaultLanguage: e.target.value })}
                  options={LANGUAGE_OPTIONS.map((l) => ({ value: l.value, label: l.label }))}
                />
              </Field>
              <div className="h-px bg-white/8" />
              <Toggle
                checked={settings.defaultShared}
                onChange={(v) => set({ defaultShared: v })}
                label="Neue Projekte direkt teilbar"
                hint="Projekte starten mit aktivem Teilen-Link statt privat."
              />
            </div>
          </Card>

          <Card
            title="Arbeitsregeln"
            hint="Leitlinien, die MAGYC bei jedem neuen Briefing berücksichtigt — z. B. „immer mit natürlichem Licht arbeiten“ oder „keine Vorkasse über 30 %“."
          >
            <TagEditor
              items={settings.rules}
              onAdd={(v) => set({ rules: [...settings.rules, v].slice(0, 12) })}
              onRemove={(i) => set({ rules: settings.rules.filter((_, j) => j !== i) })}
              placeholder="Regel hinzufügen + Enter"
              glyph="§"
              emptyHint="Noch keine Regeln hinterlegt."
            />
          </Card>

          <Card title="Mehr">
            <div className="flex flex-col gap-2 text-[14px]">
              <Link href="/studio/vertragsinhalte" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-white/80 transition-colors hover:border-white/25 hover:text-white">
                <span>Vertragsinhalte <span className="text-white/40">— Konditionen & Geschäftsdaten</span></span>
                <span aria-hidden className="text-white/40">→</span>
              </Link>
              <Link href="/studio/fast-prompts" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-white/80 transition-colors hover:border-white/25 hover:text-white">
                <span>Fast-Prompts <span className="text-white/40">— wiederkehrende Textbausteine</span></span>
                <span aria-hidden className="text-white/40">→</span>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
