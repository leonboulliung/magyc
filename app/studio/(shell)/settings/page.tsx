"use client";

import { useRouter } from "next/navigation";
import { useStudioProfile } from "@/components/studio/useStudioProfile";
import { LANGUAGE_OPTIONS } from "@/lib/studioProfile";
import { PageHeader, Card, Field, Segmented, Select, Toggle } from "@/components/studio/formKit";

/**
 * Einstellungen — account-wide defaults for new projects (language, sharing).
 * Contract content lives on its own Vertragsinhalte page; Schnellbausteine on theirs.
 */
export default function StudioSettingsPage() {
  const router = useRouter();
  const { profile, status, update } = useStudioProfile();
  const settings = profile?.settings;
  const set = (patch: Partial<NonNullable<typeof settings>>) => {
    if (!settings) return;
    update({ settings: { ...settings, ...patch } });
  };
  const setTheme = (projectTheme: "dark" | "light") => {
    document.documentElement.dataset.studioTheme = projectTheme;
    document.documentElement.style.colorScheme = projectTheme;
    set({ projectTheme });
    window.setTimeout(() => router.refresh(), 900);
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

          <Card title="Darstellung">
            <Field label="Projektseite" hint="Die Leinwand deiner Projektseiten. Die projektbezogene Akzentfarbe bleibt; nur Hintergrund und Schrift wechseln. Gilt auch für deine Kunden.">
              <div className="mt-2">
                <Segmented
                  value={settings.projectTheme}
                  onChange={setTheme}
                  options={[
                    { value: "light", label: "Hell" },
                    { value: "dark", label: "Dunkel" },
                  ]}
                />
              </div>
            </Field>
          </Card>
        </div>
      )}
    </div>
  );
}
