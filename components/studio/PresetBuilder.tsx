"use client";

import { useEffect, useMemo, useState } from "react";
import { bodyTypes } from "@/lib/modules";
import type { ModuleType } from "@/lib/types";

type ElementDefaults = {
  title?: string;
  rows?: string[];
  location?: string;
  date?: string;
  notes?: string;
};

type Preset = {
  id: string;
  name: string;
  description: string;
  modules: ModuleType[];
  defaults: Record<string, ElementDefaults>;
  promptInjections: string[];
};

const HIDDEN_IN_PICKER = new Set<ModuleType>(["wikipedia", "gif", "icon"]);
const ELEMENT_TYPES = bodyTypes().filter((type) => !HIDDEN_IN_PICKER.has(type));

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

const DEFAULT_PRESETS: Preset[] = [
  {
    id: "product",
    name: "Produktshooting",
    description: "Packshots, Editorials und Webshop-Serien.",
    modules: ["moodboard", "shot_list", "table", "deliverables", "approvals"],
    defaults: {
      shot_list: { rows: ["Hero-Aufnahme", "Detail / Prozess", "Packshot frontal"] },
      table: { rows: ["Kamera: ", "Objektiv: ", "Licht: ", "Tethering: "] },
      deliverables: { rows: ["Webshop", "Social Crops", "Retusche"] },
    },
    promptInjections: [
      "Plane wie ein kommerzieller Produktfotograf: klare Deliverables, Nutzungsrechte, Shotlist und Freigaben immer explizit machen.",
    ],
  },
  {
    id: "wedding",
    name: "Hochzeit",
    description: "Ablauf, Orte, Must-have-Motive und Übergabe.",
    modules: ["shot_list", "locations_multi", "appointment", "checklist", "deliverables"],
    defaults: {
      shot_list: { rows: ["Getting Ready", "Trauung", "Gruppenbilder", "Paarshooting", "Party"] },
      locations_multi: { location: "Standesamt / Kirche / Location" },
    },
    promptInjections: ["Sensible Kommunikation, klare Timings und Must-have-Momente priorisieren."],
  },
];

const STORAGE_KEY = "magyc.studio.presets.v2";

function createEmptyPreset(): Preset {
  return {
    id: `preset-${Date.now()}`,
    name: "Neues Preset",
    description: "",
    modules: ["moodboard"],
    defaults: {},
    promptInjections: [""],
  };
}

function cleanPresets(raw: unknown): Preset[] | null {
  if (!Array.isArray(raw)) return null;
  const allowed = new Set(ELEMENT_TYPES);
  const parsed = raw
    .map((item) => {
      const candidate = item as Partial<Preset>;
      const modules = Array.isArray(candidate.modules)
        ? candidate.modules.filter((type): type is ModuleType => allowed.has(type as ModuleType))
        : [];
      if (!candidate.id || !candidate.name || modules.length === 0) return null;
      return {
        id: String(candidate.id),
        name: String(candidate.name),
        description: typeof candidate.description === "string" ? candidate.description : "",
        modules,
        defaults: candidate.defaults && typeof candidate.defaults === "object" ? candidate.defaults : {},
        promptInjections: Array.isArray(candidate.promptInjections)
          ? candidate.promptInjections.filter((prompt): prompt is string => typeof prompt === "string")
          : [""],
      };
    })
    .filter(Boolean) as Preset[];
  return parsed.length > 0 ? parsed : null;
}

export function PresetBuilder() {
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [activeId, setActiveId] = useState(DEFAULT_PRESETS[0].id);
  const [activeElement, setActiveElement] = useState<ModuleType>(DEFAULT_PRESETS[0].modules[0]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = cleanPresets(raw ? JSON.parse(raw) : null);
      if (!parsed) return;
      setPresets(parsed);
      setActiveId(parsed[0].id);
      setActiveElement(parsed[0].modules[0]);
    } catch {
      // Local preset drafts should never prevent Studio from opening.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  const active = useMemo(
    () => presets.find((preset) => preset.id === activeId) || presets[0],
    [activeId, presets],
  );

  useEffect(() => {
    if (!active.modules.includes(activeElement)) setActiveElement(active.modules[0]);
  }, [active.modules, activeElement]);

  function updateActive(patch: Partial<Preset>) {
    setPresets((items) =>
      items.map((preset) => (preset.id === active.id ? { ...preset, ...patch } : preset)),
    );
  }

  function toggleModule(type: ModuleType) {
    const selected = active.modules.includes(type);
    if (selected && active.modules.length === 1) return;
    const modules = selected
      ? active.modules.filter((item) => item !== type)
      : [...active.modules, type];
    updateActive({ modules });
    if (!selected) setActiveElement(type);
  }

  function updateDefault(type: ModuleType, patch: ElementDefaults) {
    updateActive({
      defaults: {
        ...active.defaults,
        [type]: { ...(active.defaults[type] || {}), ...patch },
      },
    });
  }

  function updateDefaultRow(type: ModuleType, index: number, value: string) {
    const current = active.defaults[type]?.rows || [""];
    const next = [...current];
    next[index] = value;
    updateDefault(type, { rows: next });
  }

  function addDefaultRow(type: ModuleType) {
    const current = active.defaults[type]?.rows || [];
    updateDefault(type, { rows: [...current, ""] });
  }

  function addPreset() {
    const next = createEmptyPreset();
    setPresets((items) => [...items, next]);
    setActiveId(next.id);
    setActiveElement(next.modules[0]);
  }

  function duplicatePreset() {
    const next = {
      ...active,
      id: `preset-${Date.now()}`,
      name: `${active.name} Kopie`,
      defaults: { ...active.defaults },
      promptInjections: [...active.promptInjections],
    };
    setPresets((items) => [...items, next]);
    setActiveId(next.id);
  }

  function removePreset() {
    if (presets.length === 1) return;
    const next = presets.filter((preset) => preset.id !== active.id);
    setPresets(next);
    setActiveId(next[0].id);
    setActiveElement(next[0].modules[0]);
  }

  function updatePrompt(index: number, value: string) {
    updateActive({
      promptInjections: active.promptInjections.map((prompt, i) => (i === index ? value : prompt)),
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Presets</p>
          <h1 className="mt-3 font-brand text-[32px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">
            Wiederkehrende Projekte vorbereiten
          </h1>
        </div>
        <button
          type="button"
          onClick={addPreset}
          className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/85"
        >
          Neues Preset
        </button>
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-white/12">
        <table className="w-full border-collapse text-left">
          <thead className="bg-white/[0.04]">
            <tr className="mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              <th className="px-4 py-3 font-normal">Preset</th>
              <th className="hidden px-4 py-3 font-normal md:table-cell">Elemente</th>
              <th className="hidden px-4 py-3 font-normal lg:table-cell">Prompt</th>
              <th className="px-4 py-3 text-right font-normal">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {presets.map((preset) => (
              <tr
                key={preset.id}
                className={`border-t border-white/10 text-white/75 ${
                  preset.id === active.id ? "bg-white/[0.055]" : "hover:bg-white/[0.03]"
                }`}
              >
                <td className="px-4 py-4">
                  <button type="button" onClick={() => setActiveId(preset.id)} className="text-left">
                    <span className="block text-[15px] font-semibold text-white">{preset.name || "Unbenannt"}</span>
                    {preset.description && (
                      <span className="mt-1 block text-[12px] text-white/40">{preset.description}</span>
                    )}
                  </button>
                </td>
                <td className="hidden px-4 py-4 text-[13px] text-white/50 md:table-cell">
                  {preset.modules.length} von {ELEMENT_TYPES.length}
                </td>
                <td className="hidden px-4 py-4 text-[13px] text-white/50 lg:table-cell">
                  {preset.promptInjections.filter(Boolean).length || 0} Regeln
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveId(preset.id)}
                      className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/55 hover:border-white/35 hover:text-white"
                    >
                      Bearbeiten
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.25fr]">
        <div className="rounded-2xl border border-white/12 bg-white/[0.025] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] text-white/45">Name</span>
              <input
                value={active.name}
                onChange={(event) => updateActive({ name: event.target.value })}
                className="mt-2 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="z. B. Hochzeit"
              />
            </label>
            <label className="block">
              <span className="text-[12px] text-white/45">Kurzbeschreibung</span>
              <input
                value={active.description}
                onChange={(event) => updateActive({ description: event.target.value })}
                className="mt-2 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="Wann nutzt du dieses Preset?"
              />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Elementpool</p>
            <span className="text-[12px] text-white/35">{ELEMENT_TYPES.length} verfügbare Elemente</span>
          </div>
          <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-white/10">
            {ELEMENT_TYPES.map((type) => {
              const selected = active.modules.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleModule(type)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 text-left text-sm last:border-b-0 ${
                    selected ? "bg-white text-black" : "text-white/65 hover:bg-white/[0.055] hover:text-white"
                  }`}
                >
                  <span>{LABELS[type]}</span>
                  <span className="mono text-[10px] uppercase tracking-widest opacity-55">
                    {selected ? "aktiv" : "aus"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={duplicatePreset}
              className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/55 hover:border-white/35 hover:text-white"
            >
              Duplizieren
            </button>
            <button
              type="button"
              onClick={removePreset}
              disabled={presets.length === 1}
              className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/45 hover:border-red-300/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Löschen
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/[0.025] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Projektseiten-Vorschau</p>
              <p className="mt-1 text-[13px] text-white/45">Aktive Elemente auswählen und vorkonfigurieren.</p>
            </div>
            <span className="mono rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-widest text-white/45">
              {active.modules.length} aktiv
            </span>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {active.modules.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveElement(type)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                  activeElement === type
                    ? "border-white bg-white text-black"
                    : "border-white/12 text-white/55 hover:border-white/35 hover:text-white"
                }`}
              >
                {LABELS[type]}
              </button>
            ))}
          </div>

          <ElementConfigurator
            type={activeElement}
            value={active.defaults[activeElement] || {}}
            onChange={(patch) => updateDefault(activeElement, patch)}
            onRowChange={(index, value) => updateDefaultRow(activeElement, index, value)}
            onAddRow={() => addDefaultRow(activeElement)}
          />

          <div className="mt-7">
            <div className="flex items-center justify-between gap-3">
              <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Prompt-Regeln</p>
              <button
                type="button"
                onClick={() => updateActive({ promptInjections: [...active.promptInjections, ""] })}
                className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/55 hover:border-white/35 hover:text-white"
              >
                Hinzufügen
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {active.promptInjections.map((prompt, index) => (
                <div key={index} className="flex gap-2">
                  <textarea
                    value={prompt}
                    onChange={(event) => updatePrompt(index, event.target.value)}
                    rows={2}
                    className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-white/35"
                    placeholder="Regel, die beim Erstellen automatisch in den Prompt geht."
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateActive({
                        promptInjections: active.promptInjections.filter((_, i) => i !== index),
                      })
                    }
                    className="h-10 w-10 rounded-full border border-white/12 text-white/40 hover:border-white/35 hover:text-white"
                    aria-label="Prompt entfernen"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ElementConfigurator({
  type,
  value,
  onChange,
  onRowChange,
  onAddRow,
}: {
  type: ModuleType;
  value: ElementDefaults;
  onChange: (patch: ElementDefaults) => void;
  onRowChange: (index: number, value: string) => void;
  onAddRow: () => void;
}) {
  const rows = value.rows && value.rows.length > 0 ? value.rows : [""];

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{LABELS[type]}</p>
          <p className="mt-1 text-[12px] text-white/40">{configHint(type)}</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-[12px] text-white/45">Element-Titel</span>
        <input
          value={value.title || ""}
          onChange={(event) => onChange({ title: event.target.value })}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
          placeholder={LABELS[type]}
        />
      </label>

      {isLocationType(type) && (
        <label className="mt-4 block">
          <span className="text-[12px] text-white/45">Ort / Adresse / Route</span>
          <input
            value={value.location || ""}
            onChange={(event) => onChange({ location: event.target.value })}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
            placeholder="z. B. Studio Berlin, Musterstraße 1"
          />
        </label>
      )}

      {isDateType(type) && (
        <label className="mt-4 block">
          <span className="text-[12px] text-white/45">Datum / Zeitfenster</span>
          <input
            value={value.date || ""}
            onChange={(event) => onChange({ date: event.target.value })}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
            placeholder="z. B. 12. Juli, 10:00 - 16:00"
          />
        </label>
      )}

      {usesRows(type) && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[12px] text-white/45">{rowLabel(type)}</span>
            <button type="button" onClick={onAddRow} className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/55 hover:border-white/35 hover:text-white">
              Zeile
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((row, index) => (
              <input
                key={index}
                value={row}
                onChange={(event) => onRowChange(index, event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder={rowPlaceholder(type, index)}
              />
            ))}
          </div>
        </div>
      )}

      <label className="mt-4 block">
        <span className="text-[12px] text-white/45">Notizen für dieses Element</span>
        <textarea
          value={value.notes || ""}
          onChange={(event) => onChange({ notes: event.target.value })}
          rows={3}
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-white/35"
          placeholder="Optional: was dieses Element bei neuen Projekten bereits wissen soll."
        />
      </label>
    </div>
  );
}

function isLocationType(type: ModuleType) {
  return type === "location_single" || type === "locations_multi" || type === "location_suggestions" || type === "route";
}

function isDateType(type: ModuleType) {
  return type === "date" || type === "appointment" || type === "appointments" || type === "range" || type === "phases";
}

function usesRows(type: ModuleType) {
  return [
    "shot_list",
    "parts_list",
    "table",
    "crew",
    "work_packages",
    "deliverables",
    "approvals",
    "checklist",
    "moodboard",
    "poll",
    "qa",
  ].includes(type);
}

function rowLabel(type: ModuleType) {
  if (type === "shot_list") return "Motive";
  if (type === "parts_list") return "Material / Requisiten";
  if (type === "crew") return "Rollen";
  if (type === "deliverables") return "Abgaben";
  if (type === "approvals") return "Freigaben";
  if (type === "moodboard") return "Bildrichtungen";
  return "Einträge";
}

function rowPlaceholder(type: ModuleType, index: number) {
  if (type === "shot_list") return ["Hero-Aufnahme", "Detail", "Packshot"][index] || "Motiv";
  if (type === "parts_list") return ["Kamera", "Objektiv", "Styling"][index] || "Material";
  if (type === "crew") return ["Fotograf", "Assistenz", "Kunde"][index] || "Rolle";
  if (type === "table") return ["Kamera: ", "Objektiv: ", "Licht: "][index] || "Zeile";
  return "Eintrag";
}

function configHint(type: ModuleType) {
  if (isLocationType(type)) return "Ort, Adressen oder Routenpunkte für neue Projekte vorgeben.";
  if (isDateType(type)) return "Timing, Termine oder Phasen als Vorgabe speichern.";
  if (usesRows(type)) return "Standard-Einträge anlegen, die später ins echte Projekt übernommen werden.";
  return "Titel und optionale Notizen für dieses Element vorbereiten.";
}
