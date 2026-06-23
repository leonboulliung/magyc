"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { defaultWidget } from "@/components/WidgetPicker";
import { readApiJson, showApiError, showUnknownError } from "@/lib/client/feedback";
import {
  cleanStudioPresets,
  createStudioPreset,
  PRESET_ELEMENT_TYPES,
  STUDIO_PRESETS_STORAGE_KEY,
  type StudioPreset,
} from "@/lib/studioPresets";
import type { ModuleType } from "@/lib/types";

const LABELS: Record<ModuleType, string> = {
  heading: "Titel", rich_text: "Text", tags: "Tags", wikipedia: "Wikipedia",
  ai_summary: "KI-Einschätzung", icon: "Icon", location_single: "Ort",
  locations_multi: "Orte", location_suggestions: "Ortsvorschläge", route: "Route",
  date: "Datum", appointment: "Termin", appointments: "Termine", range: "Von - Bis",
  crew: "Team & Rollen", work_packages: "Aufgaben", deliverables: "Deliverables",
  approvals: "Freigaben", notes: "Notizen", qa: "Fragen", poll: "Umfrage",
  discussion: "Diskussion", phases: "Phasen", checklist: "Checkliste",
  attachments: "Dateien", images: "Bilder", moodboard: "Moodboard",
  selection: "Auswahl", audio: "Audio", sketch: "Skizze",
  table: "Tabelle / Technikliste", shot_list: "Shotlist",
  parts_list: "Material / Requisiten", gif: "GIF",
};

/**
 * PresetBuilder — reusable project starters. A compact list; editing opens a
 * single, well-structured pop-up holding ALL controls (name, description,
 * context toggle, elements, prompt rules). Presets define WHICH elements +
 * rules seed a project; the concrete content comes from the prompt at creation
 * (grounded), so there is no bulky per-element preview here. Autosaved to the
 * account with a local fallback.
 */
export function PresetBuilder() {
  const [presets, setPresets] = useState<StudioPreset[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  function patch(id: string, p: Partial<StudioPreset>) {
    setPresets((items) => items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function addPreset() {
    const preset = createStudioPreset();
    setPresets((items) => [...items, preset]);
    setEditingId(preset.id);
    setPickerOpen(false);
  }
  function deletePreset(id: string) {
    setPresets((items) => items.filter((p) => p.id !== id));
    setEditingId(null);
  }
  function addElement(type: ModuleType) {
    if (!editing) return;
    const w = defaultWidget(type);
    if (!w) return;
    patch(editing.id, { modules: [...editing.modules, { ...w, microTitle: w.microTitle || LABELS[type] }] });
    setPickerOpen(false);
  }
  function removeElement(i: number) {
    if (!editing) return;
    patch(editing.id, { modules: editing.modules.filter((_, j) => j !== i) });
  }
  function setPrompt(i: number, value: string) {
    if (!editing) return;
    patch(editing.id, { promptInjections: editing.promptInjections.map((p, j) => (j === i ? value : p)) });
  }
  function addPrompt() { if (editing) patch(editing.id, { promptInjections: [...editing.promptInjections, ""] }); }
  function removePrompt(i: number) { if (editing) patch(editing.id, { promptInjections: editing.promptInjections.filter((_, j) => j !== i) }); }

  function finish() {
    // Empty presets are harmless — they're filtered out where presets are used
    // (usablePresets requires modules.length > 0), so closing is always allowed.
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
              <div className="truncate text-[15px] font-medium text-white">{p.name || "Unbenannt"}</div>
              {p.description && <div className="mt-0.5 truncate text-[12px] text-black/45">{p.description}</div>}
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
                <label className="block">
                  <span className="mono text-[10px] uppercase tracking-widest text-black/40">Kurzbeschreibung</span>
                  <input value={editing.description} onChange={(e) => patch(editing.id, { description: e.target.value })} placeholder="Wann nutzt du es?" maxLength={500} className={`${field} mt-1.5`} />
                </label>
              </div>

              <button type="button" onClick={() => patch(editing.id, { allowContextModules: editing.allowContextModules === false })} className="flex w-full items-center justify-between gap-4 text-left">
                <span>
                  <span className="block text-[14px] text-black/85">Kontext-Elemente erlauben</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-black/40">MAGYC darf passende Elemente ergänzen.</span>
                </span>
                <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: editing.allowContextModules !== false ? "#fff" : "rgba(255,255,255,0.15)" }}>
                  <span className="absolute top-0.5 h-5 w-5 rounded-full transition-transform" style={{ left: 2, background: editing.allowContextModules !== false ? "#000" : "#fff", transform: editing.allowContextModules !== false ? "translateX(20px)" : "none" }} />
                </span>
              </button>

              {/* Elements */}
              <div>
                <div className="mono mb-2 text-[10px] uppercase tracking-widest text-black/40">Elemente</div>
                {editing.modules.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {editing.modules.map((m, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-black/15 py-1 pl-3 pr-1 text-[13px] text-black/80">
                        {m.microTitle || LABELS[m.type]}
                        <button type="button" onClick={() => removeElement(i)} aria-label="Entfernen" className="grid h-5 w-5 place-items-center rounded-full text-[13px] leading-none text-black/40 hover:bg-white/10 hover:text-[#17171a]">×</button>
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
                      {PRESET_ELEMENT_TYPES.map((t) => (
                        <button key={t} type="button" onClick={() => addElement(t)} className="truncate rounded px-2.5 py-2 text-left text-[12px] text-black/70 transition-colors hover:bg-black/[0.06] hover:text-[#17171a]">
                          {LABELS[t]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
