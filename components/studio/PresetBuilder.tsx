"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { defaultWidget, widgetPickerSymbolFor } from "@/components/WidgetPicker";
import { WidgetDispatcher } from "@/components/widgets/WidgetDispatcher";
import { WidgetContext } from "@/lib/widgetContext";
import {
  applyPresetStateAction,
  presetStateForPreview,
  removePresetModuleState,
  type PresetStateEntry,
} from "@/lib/presetState";
import { readApiJson, showActionError, showApiError, showUnknownError } from "@/lib/client/feedback";
import {
  cleanStudioPresets,
  createStudioPreset,
  PRESET_ELEMENT_TYPES,
  STUDIO_PRESETS_STORAGE_KEY,
  type StudioPreset,
} from "@/lib/studioPresets";
import type { Module, ModuleType, SpaceLabels } from "@/lib/types";

const LABELS: Record<ModuleType, string> = {
  heading: "Titel", rich_text: "Text", tags: "Tags", wikipedia: "Wikipedia",
  ai_summary: "KI-Einschätzung", icon: "Icon", location_single: "Ort",
  locations_multi: "Orte", location_suggestions: "Ortsvorschläge", route: "Route",
  date: "Datum", appointment: "Termin", appointments: "Termine", range: "Von - Bis",
  crew: "Team & Rollen", work_packages: "Aufgaben", deliverables: "Deliverables",
  approvals: "Freigaben", notes: "Notizen", qa: "Fragen", poll: "Umfrage",
  discussion: "Diskussion (alt)", phases: "Phasen", checklist: "Checkliste",
  attachments: "Dateien", images: "Bilder", moodboard: "Moodboard",
  selection: "Auswahl", audio: "Audio", sketch: "Skizze",
  table: "Tabelle / Technikliste", shot_list: "Shotlist",
  parts_list: "Material / Requisiten", gif: "GIF",
};

/**
 * PresetBuilder — reusable project starters. Presets define which real MAGYC
 * elements seed a project, and the active element can be preconfigured through
 * the same renderer it uses on a project page. Autosaved to the account with a
 * local fallback.
 */
export function PresetBuilder() {
  const [presets, setPresets] = useState<StudioPreset[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeElementIndex, setActiveElementIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [syncState, setSyncState] = useState<"loading" | "saved" | "local" | "error">("loading");
  const hydratedRef = useRef(false);
  const remoteWritableRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let local: StudioPreset[] | null = null;
      try {
        const raw = window.localStorage.getItem(STUDIO_PRESETS_STORAGE_KEY);
        local = cleanStudioPresets(raw ? JSON.parse(raw) : null);
      } catch { /* local drafts must never block Studio */ }
      try {
        const res = await fetch("/api/studio/presets", { cache: "no-store" });
        const json = await readApiJson(res);
        if (!res.ok || !Array.isArray(json.presets)) throw new Error("presets_failed");
        const remote = cleanStudioPresets(json.presets) ?? [];
        if (!cancelled) { setPresets(remote); setSyncState("saved"); remoteWritableRef.current = true; }
      } catch {
        if (!cancelled) { if (local) setPresets(local); setSyncState("local"); remoteWritableRef.current = false; }
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    }
    void load();
    return () => { cancelled = true; if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.localStorage.setItem(STUDIO_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    if (!remoteWritableRef.current) { setSyncState("local"); return; }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/studio/presets", {
          method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ presets }),
        });
        const json = await readApiJson(res);
        if (!res.ok) {
          setSyncState("error"); remoteWritableRef.current = false;
          showApiError("Presets nicht gespeichert", json, { fallback: "Deine Presets bleiben lokal erhalten." });
          return;
        }
        setSyncState("saved");
      } catch (error) {
        setSyncState("error"); remoteWritableRef.current = false;
        showUnknownError("Presets nicht gespeichert", error, { fallback: "Deine Presets bleiben lokal erhalten." });
      }
    }, 650);
  }, [presets]);

  const editing = useMemo(() => presets.find((p) => p.id === editingId) || null, [editingId, presets]);
  const activeModule = editing?.modules[activeElementIndex] ?? null;

  useEffect(() => {
    if (!editing) return;
    setActiveElementIndex((index) => Math.max(0, Math.min(index, Math.max(0, editing.modules.length - 1))));
  }, [editing]);

  function patch(id: string, p: Partial<StudioPreset>) {
    setPresets((items) => items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function addPreset() {
    const preset = createStudioPreset();
    setPresets((items) => [...items, preset]);
    setEditingId(preset.id);
    setActiveElementIndex(0);
    setPickerOpen(false);
  }
  function deletePreset(id: string) {
    setPresets((items) => items.filter((p) => p.id !== id));
    setEditingId(null);
  }
  function addElement(type: ModuleType) {
    if (!editing) return;
    if (editing.modules.some((module) => module.type === type)) return;
    const w = defaultWidget(type);
    if (!w) return;
    const next = [...editing.modules, { ...w, microTitle: w.microTitle || LABELS[type] }];
    patch(editing.id, { modules: next });
    setActiveElementIndex(next.length - 1);
    setPickerOpen(false);
  }
  function removeElement(i: number) {
    if (!editing) return;
    const next = editing.modules.filter((_, j) => j !== i);
    patch(editing.id, {
      modules: next,
      templateState: removePresetModuleState(editing.templateState, i),
    });
    setActiveElementIndex((current) => Math.max(0, Math.min(current > i ? current - 1 : current, Math.max(0, next.length - 1))));
  }
  function setElement(i: number, module: Module) {
    if (!editing) return;
    patch(editing.id, { modules: editing.modules.map((existing, j) => (j === i ? module : existing)) });
  }
  function ingestStateEntry(id: string, entry: PresetStateEntry) {
    setPresets((items) => items.map((preset) => {
      if (preset.id !== id || preset.templateState.some((current) => current.id === entry.id)) return preset;
      return { ...preset, templateState: [...preset.templateState, entry] };
    }));
  }
  function setPrompt(i: number, value: string) {
    if (!editing) return;
    patch(editing.id, { promptInjections: editing.promptInjections.map((p, j) => (j === i ? value : p)) });
  }
  function addPrompt() { if (editing) patch(editing.id, { promptInjections: [...editing.promptInjections, ""] }); }
  function removePrompt(i: number) { if (editing) patch(editing.id, { promptInjections: editing.promptInjections.filter((_, j) => j !== i) }); }

  function finish() {
    if (editing && editing.modules.length === 0) {
      showActionError("Preset noch unvollständig", {
        description: "Wähle mindestens ein Element aus oder lösche das leere Preset.",
      });
      return;
    }
    setEditingId(null);
    setPickerOpen(false);
  }

  const field = "w-full rounded-xl border border-black/12 bg-white/[0.035] px-3 py-2.5 text-[14px] text-[#17171a] outline-none placeholder:text-black/25 focus:border-black/35";

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="mono text-[11px] uppercase tracking-[0.22em] text-black/45">Studio · Presets</p>
            <span className="mono text-[11px] tracking-widest text-black/35">
              {syncState === "loading" && "Lädt …"}
              {syncState === "saved" && "✓ Gespeichert"}
              {syncState === "local" && "Lokal gesichert"}
              {syncState === "error" && "Nicht gespeichert"}
            </span>
          </div>
          <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-[#17171a] sm:text-[32px]">Presets</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-black/55">
            Wiederkehrende Projektstarts: einmal Elemente + Prompt-Regeln festlegen,
            danach legst du solche Projekte strukturiert mit einem Klick an.
          </p>
        </div>
        <button type="button" onClick={addPreset} className="rounded-full bg-[#17171a] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:opacity-90">
          Neues Preset
        </button>
      </div>

      {/* Compact list */}
      <div className="mt-8 space-y-2">
        {syncState === "loading" && [0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />)}
        {syncState !== "loading" && presets.length === 0 && (
          <p className="rounded-xl border border-dashed border-black/12 px-4 py-8 text-center text-[13px] text-black/40">
            Noch keine Presets — leg mit „Neues Preset“ dein erstes an.
          </p>
        )}
        {syncState !== "loading" && presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setEditingId(p.id); setPickerOpen(false); }}
            className="flex w-full items-center gap-4 rounded-xl border border-black/10 bg-white px-4 py-3 text-left transition-colors hover:border-black/25 hover:bg-black/[0.04]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium text-[#17171a]">{p.name || "Unbenannt"}</div>
              <div className="mt-0.5 truncate text-[12px] text-black/45">
                {p.modules.length > 0 ? p.modules.map((module) => module.microTitle || LABELS[module.type]).join(" · ") : "Noch keine Elemente"}
              </div>
            </div>
            <span className="mono shrink-0 text-[11px] tracking-widest text-black/35">{p.modules.length} Elemente</span>
            <span aria-hidden className="shrink-0 text-black/30">→</span>
          </button>
        ))}
      </div>

      {/* Compact editor pop-up */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) finish(); }} title="Preset bearbeiten" maxWidth={560}>
        {editing && (
          <div className="max-h-[85vh] overflow-y-auto rounded-2xl border border-black/12 bg-white shadow-2xl">
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mono text-[10px] uppercase tracking-widest text-black/40">Name</span>
                  <input value={editing.name} onChange={(e) => patch(editing.id, { name: e.target.value })} placeholder="z. B. Hochzeit" maxLength={120} className={`${field} mt-1.5`} />
                </label>
              </div>

              <button type="button" onClick={() => patch(editing.id, { allowContextModules: editing.allowContextModules === false })} className="flex w-full items-center justify-between gap-4 text-left">
                <span>
                  <span className="block text-[14px] text-black/85">Kontext-Elemente erlauben</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-black/40">MAGYC darf passende Elemente ergänzen.</span>
                </span>
                <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: editing.allowContextModules !== false ? "var(--studio-ink)" : "var(--studio-rule)" }}>
                  <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform" style={{ left: 2, transform: editing.allowContextModules !== false ? "translateX(20px)" : "none" }} />
                </span>
              </button>

              {/* Elements */}
              <div>
                <div className="mono mb-2 text-[10px] uppercase tracking-widest text-black/40">Elemente</div>
                {editing.modules.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {editing.modules.map((m, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-[13px] transition-colors"
                        style={{
                          borderColor: activeElementIndex === i ? "var(--studio-ink)" : "var(--studio-rule)",
                          background: activeElementIndex === i ? "var(--studio-ink)" : "transparent",
                          color: activeElementIndex === i ? "var(--studio-page)" : "var(--studio-ink)",
                        }}
                      >
                        <button type="button" onClick={() => setActiveElementIndex(i)} className="inline-flex min-w-0 items-center gap-1.5">
                          <span className="mono text-[10px] opacity-65">{widgetPickerSymbolFor(m.type)}</span>
                          <span>{m.microTitle || LABELS[m.type]}</span>
                        </button>
                        <button type="button" onClick={() => removeElement(i)} aria-label="Entfernen" className="grid h-5 w-5 place-items-center rounded-full text-[13px] leading-none opacity-55 hover:bg-white/10 hover:opacity-100">×</button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-black/12 px-3 py-3 text-[13px] text-black/40">Noch keine Elemente.</p>
                )}
                <div className="relative mt-2">
                  <button type="button" onClick={() => setPickerOpen((o) => !o)} className="mono text-[12px] tracking-widest text-black/55 transition-colors hover:text-[#17171a]">
                    {pickerOpen ? "Schließen" : "+ Element hinzufügen"}
                  </button>
                  {pickerOpen && (
                    <div className="mt-2 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-black/10 bg-black/[0.04] p-1.5 sm:grid-cols-3">
                      {PRESET_ELEMENT_TYPES.filter((type) => !editing.modules.some((module) => module.type === type)).map((t) => (
                        <button key={t} type="button" onClick={() => addElement(t)} className="flex min-w-0 items-center gap-2 rounded px-2.5 py-2 text-left text-[12px] text-black/70 transition-colors hover:bg-black/[0.06] hover:text-[#17171a]">
                          <span className="mono w-5 shrink-0 text-center text-[10px] text-black/45">{widgetPickerSymbolFor(t)}</span>
                          <span className="truncate">{LABELS[t]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mono mb-2 text-[10px] uppercase tracking-widest text-black/40">Element-Vorschau</div>
                {activeModule ? (
                  <PresetModulePreview
                    presetId={editing.id}
                    module={activeModule}
                    index={activeElementIndex}
                    templateState={editing.templateState}
                    onChange={(module) => setElement(activeElementIndex, module)}
                    onStateChange={(templateState) => patch(editing.id, { templateState })}
                    onIngest={(entry) => ingestStateEntry(editing.id, entry)}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/12 bg-black/[0.03] px-4 py-8 text-center text-[13px] text-black/40">
                    Wähle links ein Element aus, um es für dieses Preset vorzukonfigurieren.
                  </div>
                )}
              </div>

              {/* Prompt rules */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="mono text-[10px] uppercase tracking-widest text-black/40">Prompt-Regeln</span>
                  <button type="button" onClick={addPrompt} className="mono text-[11px] tracking-widest text-black/45 hover:text-[#17171a]">+ Regel</button>
                </div>
                <div className="space-y-2">
                  {editing.promptInjections.length === 0 && <p className="text-[12px] text-black/30">Keine Regeln.</p>}
                  {editing.promptInjections.map((p, i) => (
                    <div key={i} className="group flex items-start gap-2">
                      <textarea value={p} onChange={(e) => setPrompt(i, e.target.value)} rows={2} placeholder="Regel, die beim Erstellen in den Prompt geht." className={`${field} resize-none leading-relaxed`} />
                      <button type="button" onClick={() => removePrompt(i)} aria-label="Entfernen" className="mt-2 text-black/30 transition-colors hover:text-[#17171a]">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-black/[0.03] px-5 py-3.5 sm:px-6">
              <button type="button" onClick={() => deletePreset(editing.id)} className="rounded-full border border-black/12 px-3.5 py-2 text-[13px] text-black/45 transition-colors hover:border-red-300/40 hover:text-red-200">
                Löschen
              </button>
              <button type="button" onClick={finish} className="rounded-full bg-[#17171a] px-5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90">
                Fertig
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

const PREVIEW_LABELS: SpaceLabels = {
  widgetLabels: Object.fromEntries(Object.entries(LABELS)),
};

function PresetModulePreview({
  presetId,
  module,
  index,
  templateState,
  onChange,
  onStateChange,
  onIngest,
}: {
  presetId: string;
  module: Module;
  index: number;
  templateState: PresetStateEntry[];
  onChange: (module: Module) => void;
  onStateChange: (entries: PresetStateEntry[]) => void;
  onIngest: (entry: PresetStateEntry) => void;
}) {
  const previewState = presetStateForPreview(presetId, templateState, index);
  return (
    <div
      className="rounded-2xl border border-black/10 bg-[#0b0c0e] p-4"
      style={{
        ["--v-radius" as string]: "18px",
        ["--v-bg" as string]: "#121416",
        ["--v-widget" as string]: "rgba(255,255,255,0.07)",
        ["--v-widget-border" as string]: "rgba(255,255,255,0.16)",
        ["--v-fg" as string]: "#f3f3ef",
        ["--v-muted" as string]: "rgba(243,243,239,0.58)",
        ["--v-rule" as string]: "rgba(255,255,255,0.14)",
        ["--v-accent" as string]: "#39d2b4",
        ["--v-font" as string]: "var(--font-body)",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <WidgetContext.Provider
        value={{
          spaceId: `preset:${presetId}`,
          title: "Preset",
          language: "de",
          labels: PREVIEW_LABELS,
          isOwner: true,
          ownerToken: null,
          refresh: () => {},
          patchModule: (_moduleIndex, next) => onChange(next),
          saveModule: async (_moduleIndex, next) => {
            onChange(next);
            return true;
          },
          act: async (_moduleIndex, kind, data) => {
            onStateChange(applyPresetStateAction(templateState, index, kind, data));
            return true;
          },
          ingestStateEntry: (entry) => {
            if (entry.moduleIndex === index) onIngest(entry);
          },
        }}
      >
        <div className="mx-auto max-w-[520px]">
          <WidgetDispatcher module={module} index={index} state={previewState} />
        </div>
      </WidgetContext.Provider>
    </div>
  );
}
