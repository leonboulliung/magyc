"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { WidgetPickerContent } from "@/components/WidgetPicker";
import { WidgetDispatcher } from "@/components/widgets/WidgetDispatcher";
import { RenderBoundary } from "@/components/ui/RenderBoundary";
import { readApiJson, showActionSuccess, showApiError, showUnknownError } from "@/lib/client/feedback";
import { WidgetContext } from "@/lib/widgetContext";
import { studioItem, studioOverlay, studioPanel, studioPopover, studioStagger } from "@/lib/anim";
import {
  cleanStudioPresets,
  createStudioPreset,
  PRESET_ELEMENT_TYPE_SET,
  STUDIO_PRESETS_STORAGE_KEY,
  type StudioPreset,
} from "@/lib/studioPresets";
import type { Module, ModuleStateKind, ModuleType, SpaceLabels } from "@/lib/types";

const LABELS: Record<ModuleType, string> = {
  heading: "Titel",
  rich_text: "Text",
  tags: "Tags",
  wikipedia: "Wikipedia",
  ai_summary: "KI-Einschätzung",
  icon: "Icon",
  location_single: "Ort",
  locations_multi: "Orte",
  location_suggestions: "Ortsvorschläge",
  route: "Route",
  date: "Datum",
  appointment: "Termin",
  appointments: "Termine",
  range: "Von - Bis",
  crew: "Team & Rollen",
  work_packages: "Aufgaben",
  deliverables: "Deliverables",
  approvals: "Freigaben",
  notes: "Notizen",
  qa: "Fragen",
  poll: "Umfrage",
  discussion: "Diskussion",
  phases: "Phasen",
  checklist: "Checkliste",
  attachments: "Dateien",
  images: "Bilder",
  moodboard: "Moodboard",
  selection: "Auswahl",
  audio: "Audio",
  sketch: "Skizze",
  table: "Tabelle / Technikliste",
  shot_list: "Shotlist",
  parts_list: "Material / Requisiten",
  gif: "GIF",
};

const EMPTY_LABELS: SpaceLabels = {};

export function PresetBuilder() {
  // Start empty and only render real presets once loaded — seeding the view
  // with the default starter presets made them flash as if they were saved
  // account presets, then get replaced by the real ones.
  const [presets, setPresets] = useState<StudioPreset[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [addingElement, setAddingElement] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [syncState, setSyncState] = useState<"loading" | "saved" | "local" | "error">("loading");
  const hydratedRef = useRef(false);
  const remoteWritableRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPresets() {
      let local: StudioPreset[] | null = null;
      try {
        const raw = window.localStorage.getItem(STUDIO_PRESETS_STORAGE_KEY);
        local = cleanStudioPresets(raw ? JSON.parse(raw) : null);
      } catch {
        // Local drafts must never block Studio.
      }

      try {
        const res = await fetch("/api/studio/presets", { cache: "no-store" });
        const json = await readApiJson(res);
        if (!res.ok || !Array.isArray(json.presets)) {
          throw new Error("presets_failed");
        }
        const remote = cleanStudioPresets(json.presets) ?? [];
        if (!cancelled) {
          setPresets(remote);
          setSyncState("saved");
          remoteWritableRef.current = true;
        }
      } catch {
        if (!cancelled) {
          if (local) setPresets(local);
          setSyncState("local");
          remoteWritableRef.current = false;
        }
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    }
    void loadPresets();
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Never touch storage before the initial load resolved, otherwise the
    // empty starting state would overwrite the user's saved presets.
    if (!hydratedRef.current) return;
    window.localStorage.setItem(STUDIO_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    if (!remoteWritableRef.current) {
      setSyncState("local");
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/studio/presets", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ presets }),
        });
        const json = await readApiJson(res);
        if (!res.ok) {
          setSyncState("error");
          remoteWritableRef.current = false;
          showApiError("Presets nicht gespeichert", json, {
            fallback: "Deine Presets bleiben lokal erhalten, konnten aber nicht im Account gespeichert werden.",
          });
          return;
        }
        setSyncState("saved");
      } catch (error) {
        setSyncState("error");
        remoteWritableRef.current = false;
        showUnknownError("Presets nicht gespeichert", error, {
          fallback: "Deine Presets bleiben lokal erhalten, konnten aber nicht im Account gespeichert werden.",
        });
      }
    }, 650);
  }, [presets]);

  const editing = useMemo(
    () => presets.find((preset) => preset.id === editingId) || null,
    [editingId, presets],
  );
  const activeModule = editing?.modules[Math.min(activeIndex, Math.max(0, editing.modules.length - 1))] || null;

  function updatePreset(id: string, patch: Partial<StudioPreset>) {
    setPresets((items) =>
      items.map((preset) => (preset.id === id ? { ...preset, ...patch } : preset)),
    );
  }

  function openPreset(id: string) {
    setEditingId(id);
    setActiveIndex(0);
    setAddingElement(false);
    setSaveError("");
  }

  function addPreset() {
    const preset = createStudioPreset();
    setPresets((items) => [...items, preset]);
    openPreset(preset.id);
  }

  function deletePreset(id: string) {
    setPresets((items) => items.filter((preset) => preset.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function addModule(module: Module) {
    if (!editing) return;
    const next = { ...module, microTitle: module.microTitle || LABELS[module.type] };
    updatePreset(editing.id, { modules: [...editing.modules, next] });
    setActiveIndex(editing.modules.length);
    setAddingElement(false);
    setSaveError("");
  }

  function removeActiveModule() {
    if (!editing || !activeModule) return;
    const next = editing.modules.filter((_, index) => index !== activeIndex);
    updatePreset(editing.id, { modules: next });
    setActiveIndex(Math.max(0, Math.min(activeIndex - 1, next.length - 1)));
  }

  function removeModuleAt(indexToRemove: number) {
    if (!editing) return;
    const next = editing.modules.filter((_, index) => index !== indexToRemove);
    updatePreset(editing.id, { modules: next });
    if (activeIndex === indexToRemove) {
      setActiveIndex(Math.max(0, Math.min(indexToRemove, next.length - 1)));
    } else if (activeIndex > indexToRemove) {
      setActiveIndex(activeIndex - 1);
    }
  }

  function updateActiveModule(module: Module) {
    if (!editing) return;
    const next = editing.modules.map((current, index) => (index === activeIndex ? module : current));
    updatePreset(editing.id, { modules: next });
  }

  function updatePrompt(index: number, value: string) {
    if (!editing) return;
    updatePreset(editing.id, {
      promptInjections: editing.promptInjections.map((prompt, i) => (i === index ? value : prompt)),
    });
  }

  function finishEditing() {
    if (!editing) return;
    if (editing.modules.length === 0) {
      setSaveError("Wähle mindestens ein Element, damit dieses Preset später einen Projektstart vorbereiten kann.");
      return;
    }
    setSaveError("");
    showActionSuccess("Preset gespeichert", {
      description: syncState === "local"
        ? "Lokal gesichert. Account-Sync wird versucht, sobald die Verbindung steht."
        : undefined,
    });
    setEditingId(null);
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={studioStagger}
      className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14"
    >
      <motion.div variants={studioItem} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Studio · Presets</p>
            <span className="mono text-[11px] tracking-widest text-white/35">
              {syncState === "loading" && "Lädt …"}
              {syncState === "saved" && "✓ Gespeichert"}
              {syncState === "local" && "Lokal gesichert"}
              {syncState === "error" && "Nicht gespeichert"}
            </span>
          </div>
          <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-white sm:text-[32px]">
            Presets
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/55">
            Wiederkehrende Projektstarts: einmal kuratierst du Elemente und Prompt-Regeln,
            danach legst du solche Projekte strukturiert mit einem Klick an.
          </p>
        </div>
        <button
          type="button"
          onClick={addPreset}
          className="rounded-full bg-white px-4 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-white/85"
        >
          Neues Preset
        </button>
      </motion.div>

      <motion.section variants={studioItem} className="mt-8 overflow-hidden rounded-2xl border border-white/12 bg-black/45">
        <table className="w-full border-collapse text-left">
          <thead className="bg-white/[0.04]">
            <tr className="mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              <th className="px-4 py-3 font-normal">Preset</th>
              <th className="hidden px-4 py-3 font-normal md:table-cell">Elemente</th>
              <th className="hidden px-4 py-3 font-normal lg:table-cell">Prompt</th>
              <th className="px-4 py-3 text-right font-normal">Aktionen</th>
            </tr>
          </thead>
          <motion.tbody variants={studioStagger}>
            {syncState === "loading" && (
              [0, 1].map((i) => (
                <tr key={`skeleton-${i}`} className="border-t border-white/10">
                  <td className="px-4 py-5" colSpan={4}>
                    <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
                  </td>
                </tr>
              ))
            )}
            {syncState !== "loading" && presets.length === 0 && (
              <tr className="border-t border-white/10">
                <td className="px-4 py-10 text-center text-[13px] text-white/40" colSpan={4}>
                  Noch keine Presets — leg mit „Neues Preset“ dein erstes an.
                </td>
              </tr>
            )}
            {syncState !== "loading" && presets.map((preset) => (
              <motion.tr
                key={preset.id}
                variants={studioItem}
                layout
                className="border-t border-white/10 text-white/75 transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-4 py-4">
                  <span className="block text-[15px] font-semibold text-white">{preset.name || "Unbenannt"}</span>
                  {preset.description && <span className="mt-1 block text-[12px] text-white/40">{preset.description}</span>}
                </td>
                <td className="hidden px-4 py-4 text-[13px] text-white/50 md:table-cell">
                  {preset.modules.length} Elemente
                </td>
                <td className="hidden px-4 py-4 text-[13px] text-white/50 lg:table-cell">
                  {preset.promptInjections.filter(Boolean).length || 0} Regeln
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => openPreset(preset.id)}
                      className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/55 hover:border-white/35 hover:text-white"
                    >
                      Bearbeiten
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </motion.section>

      <AnimatePresence>
      {editing && (
        <motion.div
          key="preset-editor"
          initial="hidden"
          animate="show"
          exit="exit"
          variants={studioOverlay}
          className="fixed inset-0 z-50 bg-black/72 backdrop-blur-md"
        >
          <button
            type="button"
            aria-label="Preset-Editor schließen"
            className="absolute inset-0 cursor-default"
            onClick={() => setEditingId(null)}
          />
          <motion.section
            variants={studioPanel}
            className="absolute bottom-0 right-0 top-0 flex w-full flex-col border-l border-white/12 bg-[#050505] shadow-2xl shadow-black/70 sm:w-[min(1040px,calc(100vw-176px))]"
          >
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-white/[0.025] px-5 py-5 sm:px-7">
              <div>
                <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Preset bearbeiten</p>
                <h2 className="mt-2 text-[24px] font-semibold text-white">{editing.name}</h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/45">
                  Workflow, Elemente und Vorgaben für neue Projekte. Links wählst du den Baustein, rechts bearbeitest du ihn so, wie er später im Projekt startet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/55 hover:border-white/35 hover:text-white"
              >
                Schließen
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[12px] text-white/45">Name</span>
                  <input
                    value={editing.name}
                    onChange={(event) => updatePreset(editing.id, { name: event.target.value })}
                    className="mt-2 w-full rounded-xl border border-white/12 bg-white/[0.035] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                    placeholder="z. B. Hochzeit"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] text-white/45">Kurzbeschreibung</span>
                  <input
                    value={editing.description}
                    onChange={(event) => updatePreset(editing.id, { description: event.target.value })}
                    className="mt-2 w-full rounded-xl border border-white/12 bg-white/[0.035] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                    placeholder="Wann nutzt du dieses Preset?"
                  />
                </label>
              </div>
              <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-white">Kontext-Elemente erlauben</span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/38">
                    Wenn aktiv, darf MAGYC bei der Projekterstellung zusätzlich passende Elemente ergänzen.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editing.allowContextModules !== false}
                  onClick={() => updatePreset(editing.id, { allowContextModules: editing.allowContextModules === false })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    editing.allowContextModules !== false ? "bg-white" : "bg-white/14"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full transition-transform ${
                      editing.allowContextModules !== false ? "translate-x-6 bg-black" : "translate-x-1 bg-white"
                    }`}
                  />
                </button>
              </label>

              <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)]">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Elemente</p>
                    <button
                      type="button"
                      onClick={() => setAddingElement((value) => !value)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-white/55 hover:border-white/35 hover:text-white"
                      aria-label="Element hinzufügen"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  {editing.modules.length > 0 ? (
                    <motion.div layout className="mt-3 flex flex-wrap gap-2">
                      {editing.modules.map((module, index) => (
                        <motion.span
                          key={`${module.type}-${index}`}
                          layout
                          className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-sm transition-colors ${
                            index === activeIndex
                              ? "border-white bg-white text-black"
                              : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveIndex(index)}
                            className="min-w-0 truncate"
                          >
                            {module.microTitle || LABELS[module.type]}
                          </button>
                          <button
                            type="button"
                            aria-label={`${module.microTitle || LABELS[module.type]} entfernen`}
                            onClick={() => removeModuleAt(index)}
                            className={`grid h-5 w-5 place-items-center rounded-full text-[13px] leading-none transition-colors ${
                              index === activeIndex ? "hover:bg-black/10" : "hover:bg-white/10"
                            }`}
                          >
                            ×
                          </button>
                        </motion.span>
                      ))}
                    </motion.div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-white/12 px-3 py-5 text-sm leading-relaxed text-white/38">
                      Noch keine Elemente. Füge die Bausteine hinzu, die dieses Preset vorbereiten soll.
                    </div>
                  )}

                  <AnimatePresence>
                  {addingElement && (
                    <PresetElementPicker
                      onClose={() => setAddingElement(false)}
                      onPick={addModule}
                    />
                  )}
                  </AnimatePresence>
                </div>

                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Element-Vorgabe</p>
                      <p className="mt-1 text-[12px] text-white/35">So startet dieses Element später im Projekt.</p>
                    </div>
                    {activeModule && (
                      <button
                        type="button"
                        onClick={removeActiveModule}
                        className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/45 hover:border-red-300/40 hover:text-red-200"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                  {activeModule ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${activeModule.type}-${activeIndex}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <PresetModulePreview
                          module={activeModule}
                          index={activeIndex}
                          onChange={updateActiveModule}
                        />
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/12 px-5 py-16 text-center">
                      <p className="text-[15px] font-medium text-white">Noch keine Element-Vorschau</p>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/42">
                        Öffne die Element-Auswahl und wähle mindestens einen Baustein, um die Projektseiten-Vorschau zu konfigurieren.
                      </p>
                    </div>
                  )}

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Prompt-Regeln</p>
                      <button
                        type="button"
                        onClick={() => updatePreset(editing.id, { promptInjections: [...editing.promptInjections, ""] })}
                        className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/55 hover:border-white/35 hover:text-white"
                      >
                        Hinzufügen
                      </button>
                    </div>
                    <motion.div layout className="mt-3 space-y-2">
                      {editing.promptInjections.map((prompt, index) => (
                        <motion.textarea
                          layout
                          key={index}
                          value={prompt}
                          onChange={(event) => updatePrompt(index, event.target.value)}
                          rows={2}
                          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-white/35"
                          placeholder="Regel, die beim Erstellen automatisch in den Prompt geht."
                        />
                      ))}
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={() => deletePreset(editing.id)}
                className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/45 hover:border-red-300/40 hover:text-red-200"
              >
                Preset löschen
              </button>
              {saveError && (
                <p className="max-w-md text-center text-sm leading-relaxed text-red-200/80">{saveError}</p>
              )}
              <button
                type="button"
                onClick={finishEditing}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85"
              >
                Fertig
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}

function PresetModulePreview({
  module,
  index,
  onChange,
}: {
  module: Module;
  index: number;
  onChange: (module: Module) => void;
}) {
  const context = useMemo(() => ({
    spaceId: "preset-preview",
    title: "Preset",
    language: "de",
    labels: EMPTY_LABELS,
    isOwner: true,
    ownerToken: null,
    refresh: () => {},
    patchModule: (_index: number, next: Module) => onChange(next),
    saveModule: async (_index: number, next: Module) => {
      onChange(next);
      return true;
    },
    act: async (_moduleIndex: number, kind: ModuleStateKind, data: Record<string, unknown>) => {
      const next = applyPresetAction(module, kind, data);
      if (next) onChange(next);
      return true;
    },
  }), [module, onChange]);

  return (
    <WidgetContext.Provider value={context}>
      <div className="vibe-root vibe-terminal">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-white/30">Projektseiten-Vorschau</span>
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-white/25">Live Element</span>
        </div>
        <div
          className="relative rounded-[var(--v-radius)]"
          style={{
            background: "#080808",
            border: "1px solid var(--v-rule)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 24px 80px rgba(0,0,0,0.24)",
            backdropFilter: "blur(18px)",
            minHeight: 240,
          }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--v-radius)]">
            <div
              style={{
                width: "100%",
                height: "100%",
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.22) 1px, transparent 1.4px)",
                backgroundSize: "24px 24px",
                backgroundPosition: "12px 12px",
              }}
            />
          </div>

          <div className="relative p-3">
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
              <div className="relative group/cell" style={{ borderRadius: "var(--v-radius)" }}>
                <RenderBoundary label="Preset-Element" resetKeys={[index, module.type]}>
                  <WidgetDispatcher module={module} index={index} state={[]} />
                </RenderBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WidgetContext.Provider>
  );
}

function applyPresetAction(
  module: Module,
  kind: ModuleStateKind,
  data: Record<string, unknown>,
): Module | null {
  const id = textValue(data.id, 80);
  const seed = seedIndex(id);

  if (module.type === "checklist" && kind === "add") {
    const text = textValue(data.text, 200);
    return text ? { ...module, items: [...module.items, { text }] } : null;
  }

  if (module.type === "moodboard") {
    if (kind === "add") {
      const label = textValue(data.label, 140);
      if (!label) return null;
      return {
        ...module,
        directions: [...module.directions, {
          label,
          note: textValue(data.note, 240) || undefined,
          status: moodboardStatus(data.status),
        }],
      };
    }
    if (kind === "edit" && seed !== null && module.directions[seed]) {
      return {
        ...module,
        directions: module.directions.map((direction, index) => index === seed ? {
          ...direction,
          label: textValue(data.label, 140) || direction.label,
          note: typeof data.note === "string" ? textValue(data.note, 240) || undefined : direction.note,
          status: moodboardStatus(data.status, direction.status),
        } : direction),
      };
    }
  }

  if (module.type === "shot_list") {
    if (kind === "add") {
      const label = textValue(data.label, 160);
      if (!label) return null;
      return {
        ...module,
        shots: [...module.shots, {
          label,
          purpose: textValue(data.purpose, 180) || undefined,
          setup: textValue(data.setup, 180) || undefined,
          location: textValue(data.location, 180) || undefined,
          notes: textValue(data.notes, 240) || undefined,
          priority: shotPriority(data.priority),
          status: shotStatus(data.status),
        }],
      };
    }
    if (kind === "edit" && seed !== null && module.shots[seed]) {
      return {
        ...module,
        shots: module.shots.map((shot, index) => index === seed ? {
          ...shot,
          label: textValue(data.label, 160) || shot.label,
          purpose: typeof data.purpose === "string" ? textValue(data.purpose, 180) || undefined : shot.purpose,
          setup: typeof data.setup === "string" ? textValue(data.setup, 180) || undefined : shot.setup,
          location: typeof data.location === "string" ? textValue(data.location, 180) || undefined : shot.location,
          notes: typeof data.notes === "string" ? textValue(data.notes, 240) || undefined : shot.notes,
          priority: shotPriority(data.priority, shot.priority),
          status: shotStatus(data.status, shot.status),
        } : shot),
      };
    }
  }

  if (module.type === "deliverables") {
    if (kind === "add") {
      const label = textValue(data.label, 200);
      if (!label) return null;
      return {
        ...module,
        items: [...module.items, {
          label,
          details: textValue(data.details, 240) || undefined,
          quantity: textValue(data.quantity, 80) || undefined,
          format: textValue(data.format, 80) || undefined,
          due: textValue(data.due, 80) || undefined,
          status: deliverableStatus(data.status),
        }],
      };
    }
    if (kind === "edit" && seed !== null && module.items[seed]) {
      return {
        ...module,
        items: module.items.map((item, index) => index === seed ? {
          ...item,
          label: textValue(data.label, 200) || item.label,
          due: typeof data.due === "string" ? textValue(data.due, 80) || undefined : item.due,
          status: deliverableStatus(data.status, item.status),
        } : item),
      };
    }
  }

  if (module.type === "approvals") {
    if (kind === "add") {
      const text = textValue(data.text, 200);
      if (!text) return null;
      return {
        ...module,
        items: [...module.items, {
          text,
          description: textValue(data.description, 240) || undefined,
          due: textValue(data.due, 80) || undefined,
          audience: approvalAudience(data.audience),
          status: approvalStatus(data.status),
        }],
      };
    }
    if (kind === "edit" && seed !== null && module.items[seed]) {
      return {
        ...module,
        items: module.items.map((item, index) => index === seed ? {
          ...item,
          text: textValue(data.text, 200) || item.text,
          due: typeof data.due === "string" ? textValue(data.due, 80) || undefined : item.due,
          status: approvalStatus(data.status, item.status),
        } : item),
      };
    }
    if (kind === "check" && seedIndex(textValue(data.itemKey, 80)) !== null) {
      const index = seedIndex(textValue(data.itemKey, 80));
      if (index === null || !module.items[index]) return null;
      return {
        ...module,
        items: module.items.map((item, itemIndex) => itemIndex === index ? {
          ...item,
          status: data.checked === false ? ("pending" as const) : ("approved" as const),
        } : item),
      };
    }
  }

  return null;
}

function textValue(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function seedIndex(id: string): number | null {
  const match = /^seed-(\d+)$/.exec(id);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isFinite(index) ? index : null;
}

function moodboardStatus(value: unknown, fallback: "reference" | "approved" | "avoid" = "reference") {
  return value === "approved" || value === "avoid" || value === "reference" ? value : fallback;
}

function shotPriority(value: unknown, fallback: "must" | "should" | "nice" = "must") {
  return value === "should" || value === "nice" || value === "must" ? value : fallback;
}

function shotStatus(value: unknown, fallback: "planned" | "captured" | "selected" = "planned") {
  return value === "captured" || value === "selected" || value === "planned" ? value : fallback;
}

function deliverableStatus(value: unknown, fallback: "planned" | "in_progress" | "ready" | "delivered" = "planned") {
  return value === "in_progress" || value === "ready" || value === "delivered" || value === "planned" ? value : fallback;
}

function approvalAudience(value: unknown, fallback: "client" | "internal" = "client") {
  return value === "internal" || value === "client" ? value : fallback;
}

function approvalStatus(value: unknown, fallback: "pending" | "requested" | "approved" = "pending") {
  return value === "requested" || value === "approved" || value === "pending" ? value : fallback;
}

function PresetElementPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (module: Module) => void;
}) {
  const context = useMemo(() => ({
    spaceId: "preset-picker",
    title: "Preset",
    language: "de",
    labels: EMPTY_LABELS,
    isOwner: true,
    ownerToken: null,
    refresh: () => {},
    patchModule: () => {},
    saveModule: async () => true,
    act: async () => true,
  }), []);

  return (
    <WidgetContext.Provider value={context}>
      <div className="vibe-root vibe-terminal">
        <motion.button
          type="button"
          aria-label="Element-Auswahl schließen"
          className="fixed inset-0 z-[60] cursor-default bg-black/45"
          onClick={onClose}
          initial="hidden"
          animate="show"
          exit="exit"
          variants={studioOverlay}
        />
        <div className="fixed inset-0 z-[61] flex items-center justify-center p-5 pointer-events-none">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Element hinzufügen"
            className="pointer-events-auto flex w-full max-w-[560px] flex-col overflow-hidden rounded-[var(--v-radius)]"
            initial="hidden"
            animate="show"
            exit="exit"
            variants={studioPopover}
            style={{
              maxHeight: "min(78dvh, 640px)",
              background: "var(--v-bg)",
              border: "1px solid var(--v-rule)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.36)",
            }}
          >
            <div
              className="flex shrink-0 items-center justify-between gap-3 px-4 py-3"
              style={{ borderBottom: "1px solid var(--v-rule)" }}
            >
              <div className="mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--v-muted)" }}>
                Element hinzufügen
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Auswahl schließen"
                className="mono rounded-full px-2 py-1 text-[11px]"
                style={{ color: "var(--v-muted)", border: "1px solid var(--v-rule)" }}
              >
                x
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain">
              <WidgetPickerContent
                allowedTypes={PRESET_ELEMENT_TYPE_SET}
                onPick={(module) => {
                  onPick(module);
                  onClose();
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </WidgetContext.Provider>
  );
}
