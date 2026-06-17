"use client";

import { useEffect, useMemo, useState } from "react";

type Preset = {
  id: string;
  name: string;
  description: string;
  modules: string[];
  moduleDefaults: Record<string, string>;
  promptInjections: string[];
};

const MODULE_POOL = [
  { key: "briefing", label: "Briefing" },
  { key: "moodboard", label: "Moodboard" },
  { key: "shot_list", label: "Shotlist" },
  { key: "locations_multi", label: "Location-Plan" },
  { key: "appointment", label: "Zeitplan" },
  { key: "crew", label: "Team & Rollen" },
  { key: "parts_list", label: "Styling / Requisiten" },
  { key: "table", label: "Technikliste" },
  { key: "deliverables", label: "Deliverables" },
  { key: "approvals", label: "Freigaben" },
  { key: "checklist", label: "Checkliste" },
  { key: "attachments", label: "Referenzen" },
] as const;

const DEFAULT_PRESETS: Preset[] = [
  {
    id: "product",
    name: "Produktshooting",
    description: "Packshots, Editorials und Webshop-Serien.",
    modules: ["briefing", "moodboard", "shot_list", "table", "deliverables", "approvals"],
    moduleDefaults: {
      table: "Kamera: \nObjektiv: \nLicht: \nTethering: ",
      deliverables: "Finale Bilder: \nFormate: Web, Social, Crops\nDeadline: ",
    },
    promptInjections: [
      "Denke wie ein kommerzieller Produktfotograf: klare Deliverables, Nutzungsrechte, Shotlist und Freigaben immer explizit machen.",
    ],
  },
  {
    id: "wedding",
    name: "Hochzeit",
    description: "Vorbereitung, Tagesablauf, Motive und Übergabe.",
    modules: ["briefing", "shot_list", "locations_multi", "appointment", "deliverables", "checklist"],
    moduleDefaults: {
      shot_list: "Getting Ready\nFirst Look\nTrauung\nGruppenbilder\nPaarshooting\nDinner\nParty",
    },
    promptInjections: [
      "Achte auf sensible Kommunikation, klare Timings und Must-have-Momente.",
    ],
  },
];

const STORAGE_KEY = "magyc.studio.presets.v1";

function createEmptyPreset(): Preset {
  return {
    id: `preset-${Date.now()}`,
    name: "Neues Preset",
    description: "",
    modules: ["briefing"],
    moduleDefaults: {},
    promptInjections: [""],
  };
}

export function PresetBuilder() {
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [activeId, setActiveId] = useState(DEFAULT_PRESETS[0].id);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Preset[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setPresets(parsed);
        setActiveId(parsed[0].id);
      }
    } catch {
      // Presets are local draft state for now; corrupted storage falls back safely.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  const active = useMemo(
    () => presets.find((preset) => preset.id === activeId) || presets[0],
    [activeId, presets],
  );

  function updateActive(patch: Partial<Preset>) {
    setPresets((items) =>
      items.map((preset) => (preset.id === active.id ? { ...preset, ...patch } : preset)),
    );
  }

  function toggleModule(moduleKey: string) {
    const hasModule = active.modules.includes(moduleKey);
    if (hasModule && active.modules.length === 1) return;
    const modules = hasModule
      ? active.modules.filter((item) => item !== moduleKey)
      : [...active.modules, moduleKey];
    updateActive({ modules });
  }

  function updateModuleDefault(moduleKey: string, value: string) {
    updateActive({
      moduleDefaults: {
        ...active.moduleDefaults,
        [moduleKey]: value,
      },
    });
  }

  function updatePrompt(index: number, value: string) {
    updateActive({
      promptInjections: active.promptInjections.map((item, i) => (i === index ? value : item)),
    });
  }

  function addPreset() {
    const next = createEmptyPreset();
    setPresets((items) => [...items, next]);
    setActiveId(next.id);
  }

  function removePreset(id: string) {
    if (presets.length === 1) return;
    const next = presets.filter((preset) => preset.id !== id);
    setPresets(next);
    if (activeId === id) setActiveId(next[0].id);
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Presets</p>
          <h1 className="mt-3 font-brand text-[30px] font-bold tracking-[-0.02em] text-white sm:text-[38px]">
            Projekt-Logik vorbereiten
          </h1>
        </div>
        <button
          type="button"
          onClick={addPreset}
          className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/85"
        >
          Neues Preset erstellen
        </button>
        <div className="space-y-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setActiveId(preset.id)}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                preset.id === active.id
                  ? "border-white/45 bg-white/[0.08]"
                  : "border-white/10 bg-white/[0.025] hover:border-white/25"
              }`}
            >
              <span className="block font-body text-[15px] font-semibold text-white">{preset.name || "Unbenannt"}</span>
              <span className="mono mt-2 block text-[10px] uppercase tracking-widest text-white/35">
                {preset.modules.length} Elemente
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-3xl border border-white/12 bg-white/[0.025] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Preset bearbeiten</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              Presets definieren, welche Elemente ein Projekt bekommt, welche Inhalte schon vorausgefüllt sind und welche Prompts automatisch in die KI-Erstellung einfließen.
            </p>
          </div>
          <button
            type="button"
            onClick={() => removePreset(active.id)}
            disabled={presets.length === 1}
            className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-white/45 hover:border-red-300/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Löschen
          </button>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] text-white/45">Name</span>
            <input
              value={active.name}
              onChange={(e) => updateActive({ name: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-white/35"
              placeholder="z. B. Hochzeit"
            />
          </label>
          <label className="block">
            <span className="text-[12px] text-white/45">Kurzbeschreibung</span>
            <input
              value={active.description}
              onChange={(e) => updateActive({ description: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-white/35"
              placeholder="Wann nutzt du dieses Preset?"
            />
          </label>
        </div>

        <div className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Elemente</p>
              <p className="mt-1 text-[13px] text-white/45">Mindestens ein Element bleibt immer aktiv.</p>
            </div>
            <span className="mono rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-widest text-white/45">
              {active.modules.length} aktiv
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE_POOL.map((module) => {
              const selected = active.modules.includes(module.key);
              return (
                <button
                  key={module.key}
                  type="button"
                  onClick={() => toggleModule(module.key)}
                  className={`rounded-full border px-4 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "border-white bg-white text-black"
                      : "border-white/12 text-white/60 hover:border-white/35 hover:text-white"
                  }`}
                >
                  {module.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Element-Inhalte vorkonfigurieren</p>
          <div className="mt-4 space-y-3">
            {active.modules.map((moduleKey) => {
              const label = MODULE_POOL.find((module) => module.key === moduleKey)?.label || moduleKey;
              return (
                <label key={moduleKey} className="block rounded-2xl border border-white/10 bg-black/30 p-4">
                  <span className="text-sm font-medium text-white">{label}</span>
                  <textarea
                    value={active.moduleDefaults[moduleKey] || ""}
                    onChange={(e) => updateModuleDefault(moduleKey, e.target.value)}
                    rows={3}
                    className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-white/35"
                    placeholder="Optional: Inhalte, die bei diesem Element immer vorbereitet sein sollen."
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Prompt-Injection</p>
            <button
              type="button"
              onClick={() => updateActive({ promptInjections: [...active.promptInjections, ""] })}
              className="rounded-full border border-white/14 px-3 py-1.5 text-sm text-white/60 hover:border-white/35 hover:text-white"
            >
              Prompt hinzufügen
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {active.promptInjections.map((prompt, index) => (
              <div key={index} className="flex gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => updatePrompt(index, e.target.value)}
                  rows={2}
                  className="min-w-0 flex-1 resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-white/35"
                  placeholder="Optionaler Prompt, der automatisch mit in die Projekterstellung geht."
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
      </section>
    </div>
  );
}
