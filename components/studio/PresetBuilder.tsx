"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import type { Dictionary } from "@/lib/i18n";
import { Dialog } from "@/components/ui/Dialog";
import { defaultWidget, widgetPickerGroups, widgetPickerSymbolFor } from "@/lib/widgetCatalog";
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

function labelsFor(t: Dictionary): Record<ModuleType, string> {
  return t.presets.labels;
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

const DELETED_PRESETS_STORAGE_KEY = `${STUDIO_PRESETS_STORAGE_KEY}.deleted`;

function cleanDeletedPresets(raw: unknown): Array<StudioPreset & { deletedAt: string }> {
  if (!Array.isArray(raw)) return [];
  const cutoff = Date.now() - 30 * 86_400_000;
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = (item as { deletedAt?: unknown }).deletedAt;
    if (typeof value !== "string") return [];
    const deletedAt = value;
    const deletedTime = new Date(deletedAt).getTime();
    if (!Number.isFinite(deletedTime) || deletedTime < cutoff) return [];
    const preset = cleanStudioPresets([item])?.[0];
    return preset ? [{ ...preset, deletedAt }] : [];
  });
}

/**
 * PresetBuilder — reusable project starters. Presets define which real MAGYC
 * elements seed a project, and the active element can be preconfigured through
 * the same renderer it uses on a project page. Autosaved to the account with a
 * local fallback.
 */
export function PresetBuilder() {
  const t = useT();
  const { locale } = useLocale();
  const labels = useMemo(() => labelsFor(t), [t]);
  const [presets, setPresets] = useState<StudioPreset[]>([]);
  const [deletedPresets, setDeletedPresets] = useState<Array<StudioPreset & { deletedAt: string }>>([]);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeElementIndex, setActiveElementIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [elementQuery, setElementQuery] = useState("");
  const [syncState, setSyncState] = useState<"loading" | "saved" | "local" | "error">("loading");
  const hydratedRef = useRef(false);
  const remoteWritableRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let local: StudioPreset[] | null = null;
      let localDeleted: Array<StudioPreset & { deletedAt: string }> = [];
      try {
        const raw = window.localStorage.getItem(STUDIO_PRESETS_STORAGE_KEY);
        local = cleanStudioPresets(raw ? JSON.parse(raw) : null);
        const deletedRaw = window.localStorage.getItem(DELETED_PRESETS_STORAGE_KEY);
        localDeleted = cleanDeletedPresets(deletedRaw ? JSON.parse(deletedRaw) : null);
      } catch { /* local drafts must never block Studio */ }
      try {
        const res = await fetch("/api/studio/presets", { cache: "no-store" });
        const json = await readApiJson(res);
        if (!res.ok || !Array.isArray(json.presets)) throw new Error("presets_failed");
        const remote = cleanStudioPresets(json.presets) ?? [];
        if (!cancelled) {
          const remoteDeleted = cleanDeletedPresets(json.deletedPresets);
          const deletedById = new Map(remoteDeleted.map((item) => [item.id, item]));
          for (const item of localDeleted) if (!deletedById.has(item.id)) deletedById.set(item.id, item);
          const deleted = [...deletedById.values()];
          const locallyDeletedIds = new Set(localDeleted.map((item) => item.id));
          setPresets(remote.filter((preset) => !locallyDeletedIds.has(preset.id)));
          setDeletedPresets(deleted);
          setSyncState("saved");
          remoteWritableRef.current = true;
        }
      } catch {
        if (!cancelled) { if (local) setPresets(local); setDeletedPresets(localDeleted); setSyncState("local"); remoteWritableRef.current = false; }
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    }
    void load();
    return () => { cancelled = true; if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try { window.localStorage.setItem(STUDIO_PRESETS_STORAGE_KEY, JSON.stringify(presets)); } catch { /* account sync remains authoritative */ }
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
          showApiError(t.studio.notSaved, json, { fallback: t.presets.builder.saveLocalFallback });
          return;
        }
        setSyncState("saved");
      } catch (error) {
        setSyncState("error"); remoteWritableRef.current = false;
        showUnknownError(t.studio.notSaved, error, { fallback: t.presets.builder.saveLocalFallback });
      }
    }, 650);
  }, [presets]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try { window.localStorage.setItem(DELETED_PRESETS_STORAGE_KEY, JSON.stringify(deletedPresets)); } catch { /* account sync remains authoritative */ }
  }, [deletedPresets]);

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
    setPickerOpen(true);
    setElementQuery("");
  }
  function deletePreset(id: string) {
    const preset = presets.find((item) => item.id === id);
    if (preset) setDeletedPresets((items) => [{ ...preset, deletedAt: new Date().toISOString() }, ...items.filter((item) => item.id !== id)]);
    setPresets((items) => items.filter((p) => p.id !== id));
    setEditingId(null);
    setElementQuery("");
  }
  function restorePreset(id: string) {
    const preset = deletedPresets.find((item) => item.id === id);
    if (!preset) return;
    const { deletedAt: _deletedAt, ...restored } = preset;
    setDeletedPresets((items) => items.filter((item) => item.id !== id));
    setPresets((items) => [...items, restored]);
  }
  function addElement(type: ModuleType) {
    if (!editing) return;
    if (editing.modules.some((module) => module.type === type)) return;
    const w = defaultWidget(type);
    if (!w) return;
    const next = [...editing.modules, { ...w, microTitle: w.microTitle || labels[type] }];
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
      showActionError(t.presets.builder.incompleteTitle, {
        description: t.presets.builder.incompleteDescription,
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
            <span className="mono text-[11px] tracking-widest text-black/35">
              {syncState === "loading" && t.common.loading}
              {syncState === "saved" && `✓ ${t.common.saved}`}
              {syncState === "local" && t.presets.builder.localSaved}
              {syncState === "error" && t.studio.notSaved}
            </span>
          </div>
          <h1 className="mt-1 font-brand text-[26px] font-bold tracking-[-0.02em] text-[#17171a] sm:text-[32px]">{t.presets.builder.title}</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-black/55">
            {t.presets.builder.intro}
          </p>
        </div>
        <button type="button" onClick={addPreset} className="rounded-full bg-[#17171a] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:opacity-90">
          {t.presets.builder.newPreset}
        </button>
      </div>

      {/* Compact list */}
      <div className="mt-8 space-y-2">
        {syncState === "loading" && [0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />)}
        {syncState !== "loading" && presets.length === 0 && (
          <p className="rounded-xl border border-dashed border-black/12 px-4 py-8 text-center text-[13px] text-black/40">
            {t.presets.builder.empty}
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
                {p.modules.length > 0 ? p.modules.map((module) => module.microTitle || labels[module.type]).join(" · ") : t.presets.builder.noElements}
              </div>
            </div>
            <span className="mono shrink-0 text-[11px] tracking-widest text-black/35">{interpolate(t.presets.builder.elementsCount, { count: p.modules.length })}</span>
            <span aria-hidden className="shrink-0 text-black/30">→</span>
          </button>
        ))}
      </div>

      {deletedPresets.length > 0 && (
        <section className="mt-5 border-t border-black/10 pt-4">
          <button type="button" onClick={() => setDeletedOpen((open) => !open)} className="flex w-full items-center justify-between py-2 text-left text-[13px] text-black/50 transition-colors hover:text-black">
            <span>{t.presets.builder.recentlyDeleted}</span>
            <span className="mono text-[10px] tracking-widest">{deletedPresets.length} {deletedOpen ? "↑" : "↓"}</span>
          </button>
          <AnimatePresence initial={false}>
            {deletedOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="space-y-2 pt-2">
                  {deletedPresets.map((preset) => {
                    const remaining = Math.max(1, 30 - Math.floor((Date.now() - new Date(preset.deletedAt).getTime()) / 86_400_000));
                    return (
                      <div key={preset.id} className="flex items-center gap-3 rounded-xl border border-black/10 bg-black/[0.025] px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] text-black/65">{preset.name}</div>
                          <div className="mt-0.5 text-[11px] text-black/35">{interpolate(t.presets.builder.recoverableDays, { count: remaining })}</div>
                        </div>
                        <button type="button" onClick={() => restorePreset(preset.id)} className="rounded-full border border-black/15 px-3 py-1.5 text-[12px] text-black/55 transition-colors hover:border-black/35 hover:text-black">{t.presets.builder.restore}</button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Compact editor pop-up */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) finish(); }} title={t.presets.builder.editPreset} maxWidth={820}>
        {editing && (
          <div className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-black/12 bg-white shadow-2xl sm:max-h-[88vh]">
            <div className="flex shrink-0 items-center gap-3 border-b border-black/10 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={finish}
                aria-label={t.common.close}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-black/12 text-[16px] leading-none text-black/50 transition-colors hover:border-black/30 hover:text-black"
              >
                ×
              </button>
              <span className="mono text-[10px] uppercase tracking-widest text-black/40">{t.presets.builder.editPreset}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
            <div className="space-y-5 p-4 sm:p-6">
              <div className="max-w-md">
                <label className="block">
                  <span className="mono text-[10px] uppercase tracking-widest text-black/40">{t.presets.builder.name}</span>
                  <input value={editing.name} onChange={(e) => patch(editing.id, { name: e.target.value })} placeholder={t.presets.builder.namePlaceholder} maxLength={120} className={`${field} mt-1.5`} />
                </label>
              </div>

              {/* Elements */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="mono text-[10px] uppercase tracking-widest text-black/40">{t.presets.builder.chooseElements}</div>
                  {editing.modules.length > 0 && (
                    <button type="button" onClick={() => setPickerOpen((open) => !open)} className="rounded-full border border-black/12 px-3 py-1.5 text-[12px] text-black/55 transition-colors hover:border-black/30 hover:text-black">
                      {pickerOpen ? t.presets.builder.closeSelection : t.presets.builder.addElement}
                    </button>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {(pickerOpen || editing.modules.length === 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="overflow-hidden rounded-xl border border-black/10 bg-black/[0.025]">
                        <div className="sticky top-0 z-10 border-b border-black/8 bg-white/95 p-2 backdrop-blur">
                          <input
                            value={elementQuery}
                            onChange={(event) => setElementQuery(event.target.value)}
                            placeholder={t.presets.builder.searchElement}
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] outline-none placeholder:text-black/30 focus:border-black/30"
                          />
                        </div>
                        <div className="max-h-[190px] overflow-y-auto overscroll-contain sm:max-h-[220px]">
                        {widgetPickerGroups().map((group, groupIndex) => {
                          const query = elementQuery.trim().toLocaleLowerCase(locale);
                          const available = group.filter((type) => PRESET_ELEMENT_TYPES.includes(type)
                            && !editing.modules.some((module) => module.type === type)
                            && (!query || labels[type].toLocaleLowerCase(locale).includes(query)));
                          if (available.length === 0) return null;
                          return (
                            <div key={groupIndex} className="grid grid-cols-2 gap-1 border-b border-black/8 p-1.5 last:border-b-0 sm:grid-cols-3">
                              {available.map((type) => (
                                <motion.button
                                  key={type}
                                  type="button"
                                  onClick={() => addElement(type)}
                                  whileHover={{ y: -2, backgroundColor: "rgba(0,0,0,0.055)" }}
                                  whileTap={{ scale: 0.98 }}
                                  className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-black/68"
                                >
                                  <span className="mono w-5 shrink-0 text-center text-[11px] text-black/42">{widgetPickerSymbolFor(type)}</span>
                                  <span className="truncate">{labels[type]}</span>
                                </motion.button>
                              ))}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {editing.modules.length > 0 ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2.5 pt-0.5 [scrollbar-width:thin]">
                    {editing.modules.map((m, i) => (
                      <span
                        key={i}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-[13px] transition-colors"
                        style={{
                          borderColor: activeElementIndex === i ? "var(--studio-ink)" : "var(--studio-rule)",
                          background: activeElementIndex === i ? "var(--studio-ink)" : "transparent",
                          color: activeElementIndex === i ? "var(--studio-page)" : "var(--studio-ink)",
                        }}
                      >
                        <button type="button" onClick={() => setActiveElementIndex(i)} className="inline-flex min-w-0 items-center gap-1.5">
                          <span className="mono text-[10px] opacity-65">{widgetPickerSymbolFor(m.type)}</span>
                          <span>{m.microTitle || labels[m.type]}</span>
                        </button>
                        <button type="button" onClick={() => removeElement(i)} aria-label={t.common.remove} className="grid h-5 w-5 place-items-center rounded-full text-[13px] leading-none opacity-55 hover:bg-white/10 hover:opacity-100">×</button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="mono mb-2 text-[10px] uppercase tracking-widest text-black/40">{t.presets.builder.elementPreview}</div>
                {activeModule ? (
                  <PresetModulePreview
                    presetId={editing.id}
                    module={activeModule}
                    index={activeElementIndex}
                    templateState={editing.templateState}
                    onChange={(module) => setElement(activeElementIndex, module)}
                    onStateChange={(templateState) => patch(editing.id, { templateState })}
                    onIngest={(entry) => ingestStateEntry(editing.id, entry)}
                    labels={labels}
                    previewTitle={t.presets.builder.previewTitle}
                    language={locale}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/12 bg-black/[0.03] px-4 py-8 text-center text-[13px] text-black/40">
                    {t.presets.builder.chooseElementHint}
                  </div>
                )}
              </div>

              {/* Prompt rules */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="mono text-[10px] uppercase tracking-widest text-black/40">{t.presets.builder.promptRules}</span>
                  <button type="button" onClick={addPrompt} className="mono text-[11px] tracking-widest text-black/45 hover:text-[#17171a]">{t.presets.builder.addRule}</button>
                </div>
                <div className="space-y-2">
                  {editing.promptInjections.length === 0 && <p className="text-[12px] text-black/30">{t.presets.builder.noRules}</p>}
                  {editing.promptInjections.map((p, i) => (
                    <div key={i} className="group flex items-start gap-2">
                      <textarea value={p} onChange={(e) => setPrompt(i, e.target.value)} rows={2} placeholder={t.presets.builder.rulePlaceholder} className={`${field} resize-none leading-relaxed`} />
                      <button type="button" onClick={() => removePrompt(i)} aria-label={t.common.remove} className="mt-2 text-black/30 transition-colors hover:text-[#17171a]">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <button type="button" onClick={() => patch(editing.id, { allowContextModules: editing.allowContextModules === false })} className="flex w-full items-center justify-between gap-4 border-t border-black/10 pt-5 text-left">
                <span>
                  <span className="block text-[14px] text-black/85">{t.presets.builder.allowContextTitle}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-black/40">{t.presets.builder.allowContextHint}</span>
                </span>
                <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: editing.allowContextModules !== false ? "var(--studio-ink)" : "var(--studio-rule)" }}>
                  <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform" style={{ left: 2, transform: editing.allowContextModules !== false ? "translateX(20px)" : "none" }} />
                </span>
              </button>
            </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-black/10 bg-black/[0.03] px-5 py-3.5 sm:px-6">
              <button type="button" onClick={() => deletePreset(editing.id)} className="rounded-full border border-black/12 px-3.5 py-2 text-[13px] text-black/45 transition-colors hover:border-red-300/40 hover:text-red-200">
                {t.common.delete}
              </button>
              <button type="button" onClick={finish} className="rounded-full bg-[#17171a] px-5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90">
                {t.presets.builder.done}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function PresetModulePreview({
  presetId,
  module,
  index,
  templateState,
  onChange,
  onStateChange,
  onIngest,
  labels,
  previewTitle,
  language,
}: {
  presetId: string;
  module: Module;
  index: number;
  templateState: PresetStateEntry[];
  onChange: (module: Module) => void;
  onStateChange: (entries: PresetStateEntry[]) => void;
  onIngest: (entry: PresetStateEntry) => void;
  labels: Record<ModuleType, string>;
  previewTitle: string;
  language: "de" | "en";
}) {
  const previewLabels: SpaceLabels = { widgetLabels: Object.fromEntries(Object.entries(labels)) };
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
        ["--v-font" as string]: "Manrope, ui-sans-serif, system-ui, sans-serif",
        ["--v-heading" as string]: "Bricolage Grotesque, Manrope, ui-sans-serif, system-ui, sans-serif",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <WidgetContext.Provider
        value={{
          mode: "preset",
          spaceId: `preset:${presetId}`,
          title: previewTitle,
          language,
          labels: previewLabels,
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
