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
  DEFAULT_STUDIO_PRESETS,
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
  audio: "Audio",
  sketch: "Skizze",
  table: "Tabelle / Technikliste",
  shot_list: "Shotlist",
  parts_list: "Material / Requisiten",
  gif: "GIF",
};

const EMPTY_LABELS: SpaceLabels = {};

export function PresetBuilder() {
  const [presets, setPresets] = useState<StudioPreset[]>(DEFAULT_STUDIO_PRESETS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [addingElement, setAddingElement] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [syncState, setSyncState] = useState<"loading" | "saved" | "local" | "error">("loading");
  const hydratedRef = useRef(false);
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
        }
      } catch {
        if (!cancelled) {
          if (local) setPresets(local);
          setSyncState("local");
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
    window.localStorage.setItem(STUDIO_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    if (!hydratedRef.current) return;
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
          showApiError("Presets nicht gespeichert", json, {
            fallback: "Deine Presets bleiben lokal erhalten, konnten aber nicht im Account gespeichert werden.",
          });
          return;
        }
        setSyncState("saved");
      } catch (error) {
        setSyncState("error");
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
          <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/40">Presets</p>
          <h1 className="mt-3 font-brand text-[32px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">
            Wiederkehrende Projekte vorbereiten
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/50">
            Presets übersetzen deine Arbeitsweise in wiederholbare Projektstarts: weniger Prompt-Arbeit, mehr klare Struktur.
          </p>
          <p className="mt-3 text-[12px] text-white/32">
            {syncState === "loading" && "Presets werden geladen …"}
            {syncState === "saved" && "Account-Presets sind synchronisiert."}
            {syncState === "local" && "Lokaler Preset-Fallback aktiv."}
            {syncState === "error" && "Presets lokal gesichert, Account-Sync fehlgeschlagen."}
          </p>
        </div>
        <button
          type="button"
          onClick={addPreset}
          className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/85"
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
            {presets.map((preset) => (
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

              <div className="mt-7 grid gap-6 lg:grid-cols-[250px_1fr]">
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
                    <motion.div layout className="mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
                      {editing.modules.map((module, index) => (
                        <motion.button
                          key={`${module.type}-${index}`}
                          layout
                          type="button"
                          onClick={() => setActiveIndex(index)}
                          whileTap={{ scale: 0.985 }}
                          className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                            index === activeIndex
                              ? "border-white bg-white text-black"
                              : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                          }`}
                        >
                          {module.microTitle || LABELS[module.type]}
                        </motion.button>
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
    act: async (_moduleIndex: number, _kind: ModuleStateKind, _data: Record<string, unknown>) => true,
  }), [onChange]);

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
