"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { studioItem, studioPage, studioStagger } from "@/lib/anim";
import {
  readApiJson,
  showActionError,
  showActionLoading,
  showActionSuccess,
  showApiError,
} from "@/lib/client/feedback";
import {
  cleanStudioPresets,
  DEFAULT_STUDIO_PRESETS,
  STUDIO_PRESETS_STORAGE_KEY,
  type StudioPreset,
} from "@/lib/studioPresets";
import { PromptComposer } from "@/components/PromptComposer";

/**
 * Guided product builder — prompt-first (like the demo): a central prompt
 * field + quick-selects for fast generation. Optional structured "Eckdaten"
 * sit behind a toggle. Creating with NOTHING is allowed — you get a starter
 * product project. Either way the brief is authored by the classifier and
 * you land in the workspace.
 */

const QUICK: string[] = [
  "Produkt-Stillleben für einen Webshop.",
  "Beauty-/Skincare-Shooting, clean auf Weiß.",
  "Editorial-Produktstrecke mit Moodboard.",
  "Packshots in mehreren Formaten für Social.",
];

interface Field {
  key: "client" | "product" | "goal" | "usage" | "deadline" | "references" | "scope";
  label: string;
  placeholder: string;
  area?: boolean;
}
const FIELDS: Field[] = [
  { key: "client", label: "Kunde / Marke", placeholder: "z. B. Studio Lumen" },
  { key: "product", label: "Produkt(e)", placeholder: "Was wird fotografiert?" },
  { key: "goal", label: "Ziel & Verwendung", placeholder: "Webshop, Social, Print …", area: true },
  { key: "usage", label: "Nutzungsrechte", placeholder: "Kanäle, Dauer" },
  { key: "deadline", label: "Termin / Deadline", placeholder: "z. B. KW 28" },
  { key: "references", label: "Referenzen", placeholder: "Links zu Moodboards, Vorbildern …", area: true },
  { key: "scope", label: "Umfang / Budget", placeholder: "z. B. 15 finale Bilder" },
];
type Values = Record<Field["key"], string>;

export default function NewProjectPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [showFields, setShowFields] = useState(false);
  // Start empty so default presets don't flash as quick-starts during the
  // load; fall back to the defaults only once we know the account has none.
  const [presets, setPresets] = useState<StudioPreset[]>([]);
  const [presetId, setPresetId] = useState<string>("none");
  const [fastPrompts, setFastPrompts] = useState<string[]>([]);
  const [v, setV] = useState<Values>({
    client: "", product: "", goal: "", usage: "", deadline: "", references: "", scope: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: Field["key"], val: string) => setV((p) => ({ ...p, [k]: val }));
  const usablePresets = useMemo(() => presets.filter((preset) => preset.modules.length > 0), [presets]);
  const selectedPreset = usablePresets.find((preset) => preset.id === presetId) || null;

  useEffect(() => {
    let cancelled = false;
    async function loadPresets() {
      let local: StudioPreset[] | null = null;
      try {
        const raw = window.localStorage.getItem(STUDIO_PRESETS_STORAGE_KEY);
        local = cleanStudioPresets(raw ? JSON.parse(raw) : null);
      } catch {
        // Presets are an acceleration layer. Creation must still work without them.
      }
      try {
        const res = await fetch("/api/studio/presets", { cache: "no-store" });
        const json = await readApiJson(res);
        if (!res.ok || !Array.isArray(json.presets)) {
          showApiError("Presets nicht geladen", json, {
            fallback: "MAGYC nutzt lokale oder Standard-Presets für diesen Projektstart.",
          });
          throw new Error("presets_failed");
        }
        const remote = cleanStudioPresets(json.presets) ?? [];
        if (!cancelled) setPresets(remote.length ? remote : DEFAULT_STUDIO_PRESETS);
      } catch {
        if (!cancelled) setPresets(local && local.length ? local : DEFAULT_STUDIO_PRESETS);
      }
    }
    void loadPresets();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the account's configured fast-prompts (click-to-insert snippets).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/studio/profile", { cache: "no-store" });
        const json = await readApiJson(res) as { profile?: { settings?: { fastPrompts?: unknown } } };
        const fps = json?.profile?.settings?.fastPrompts;
        if (!cancelled && res.ok && Array.isArray(fps)) {
          setFastPrompts(fps.filter((x: unknown): x is string => typeof x === "string"));
        }
      } catch {
        // Fast-prompts are optional; creation works without them.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (presetId !== "none" && !usablePresets.some((preset) => preset.id === presetId)) {
      setPresetId("none");
    }
  }, [presetId, usablePresets]);

  function friendlyError(code: unknown): string {
    if (code === "unauthorized") return "Bitte melde dich an, um das Projekt in deinem Studio anzulegen.";
    if (code === "ai_not_configured") return "Die KI-Erstellung ist gerade nicht konfiguriert.";
    if (code === "classify_failed") return "MAGYC konnte die Planung gerade nicht erstellen. Bitte versuche es erneut.";
    if (code === "db_unavailable") return "Die Projektdatenbank ist gerade nicht erreichbar.";
    if (code === "invalid_body") return "Die Projektdaten waren unvollständig. Bitte prüfe Preset und Eingaben.";
    if (code === "create_failed") return "Das Projekt konnte gerade nicht gespeichert werden.";
    return "Das Projekt konnte nicht erstellt werden. Bitte erneut versuchen.";
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      showActionLoading("Projekt wird erstellt …", "create-project");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment: selectedPreset?.id || "product",
          prompt,
          ...(showFields ? v : {}),
          presetName: selectedPreset?.name,
          presetModules: selectedPreset?.modules,
          presetPromptInjections: selectedPreset?.promptInjections,
          presetAllowContextModules: selectedPreset?.allowContextModules,
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok || !json?.id) {
        const message = friendlyError(json?.error);
        setError(message);
        showActionError("Projekt nicht erstellt", {
          id: "create-project",
          description: message,
        });
        setBusy(false);
        return;
      }
      showActionSuccess("Projekt erstellt", {
        id: "create-project",
        description: "Die Planung wird geöffnet.",
      });
      router.push(`/studio/${json.id}`);
    } catch {
      const message = "Netzwerkfehler. Bitte erneut versuchen.";
      setError(message);
      showActionError("Projekt nicht erstellt", {
        id: "create-project",
        description: message,
      });
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={studioPage}
      className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16"
    >
      <motion.div variants={studioItem}>
        <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Neues Projekt</p>
        <h1 className="mt-3 font-brand text-[28px] font-bold tracking-[-0.02em] text-white sm:text-[40px]">
          Planung starten
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-white/60">
          Beschreib das Shooting in einem Satz oder starte mit einem Preset. MAGYC legt das Projekt in
          <span className="text-white"> Planung</span> an und bereitet die passenden Bausteine vor.
        </p>
      </motion.div>

      <motion.div variants={studioStagger} className="mt-8 grid gap-5 lg:grid-cols-[1fr_300px]">
        <motion.div variants={studioItem}>
          <PromptComposer
            value={prompt}
            onChange={setPrompt}
            onSubmit={submit}
            autoFocus
            rows={4}
            placeholder="z. B. Produktshooting für eine handgemachte Keramik-Serie, clean und warm …"
            chips={
              <div className="flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setPrompt(q)}
                    className="rounded-full border border-white/12 px-3 py-1.5 text-left text-[13px] text-white/70 transition-colors hover:border-white/30 hover:text-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
            }
          />

          {/* Fast-Prompts — account-configured snippets, click to drop into
              the prompt. Sit BELOW the field (presets sit above/aside). */}
          {fastPrompts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {fastPrompts.map((fp, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt((p) => (p.trim() ? `${p.trimEnd()}\n${fp}` : fp))}
                  title={fp}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-white/65 transition-colors hover:border-white/30 hover:text-white"
                >
                  <span className="mono text-[11px] opacity-50">⌁</span>
                  <span className="max-w-[260px] truncate">{fp}</span>
                </button>
              ))}
            </div>
          )}
        </motion.div>

        <motion.section variants={studioItem} className="rounded-2xl border border-white/12 bg-white/[0.025] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/40">Preset</p>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/35">Planung</span>
          </div>
          <div className="mt-4 space-y-2">
            <motion.button
              type="button"
              onClick={() => setPresetId("none")}
              layout
              whileTap={{ scale: 0.985 }}
              className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                presetId === "none"
                  ? "border-white bg-white text-black"
                  : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
              }`}
            >
              Ohne Preset starten
            </motion.button>
            {usablePresets.map((preset) => (
              <motion.button
                key={preset.id}
                type="button"
                onClick={() => setPresetId(preset.id)}
                layout
                whileTap={{ scale: 0.985 }}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  presetId === preset.id
                    ? "border-white bg-white text-black"
                    : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                }`}
              >
                <span className="block font-medium">{preset.name}</span>
                {preset.description && <span className={`mt-1 block text-xs ${presetId === preset.id ? "text-black/55" : "text-white/35"}`}>{preset.description}</span>}
              </motion.button>
            ))}
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mono text-[10px] uppercase tracking-[0.2em] text-white/35">Vorbereitet</p>
            <AnimatePresence mode="wait">
              {selectedPreset ? (
                <motion.div
                  key={selectedPreset.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {selectedPreset.modules.map((module, index) => (
                    <span key={`${module.type}-${index}`} className="rounded-full border border-white/12 px-2.5 py-1 text-xs text-white/58">
                      {module.microTitle || module.type.replace("_", " ")}
                    </span>
                  ))}
                </motion.div>
              ) : (
                <motion.p
                  key="none"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-3 text-sm leading-relaxed text-white/42"
                >
                  MAGYC wählt die Bausteine aus deinem Prompt.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      </motion.div>

      <motion.button
        type="button"
        onClick={() => setShowFields((s) => !s)}
        variants={studioItem}
        className="mono mt-6 text-[11px] uppercase tracking-widest text-white/45 hover:text-white/80"
      >
        {showFields ? "Eckdaten ausblenden" : "Eckdaten hinzufügen (optional)"}
      </motion.button>

      <AnimatePresence>
      {showFields && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -6 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -6 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 space-y-4 overflow-hidden"
        >
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-[13px] text-white/70">{f.label}</label>
              {f.area ? (
                <textarea
                  value={v[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
                />
              ) : (
                <input
                  value={v[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
                />
              )}
            </div>
          ))}
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-5 text-[14px] text-red-300/90"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div variants={studioItem} className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-full bg-white px-6 py-3 font-body text-sm font-medium text-black transition-all hover:bg-white/85 active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Projekt wird erstellt …" : "Projekt erstellen"}
        </button>
        <span className="mono text-[11px] uppercase tracking-widest text-white/35">dauert ein paar Sekunden</span>
      </motion.div>
    </motion.div>
  );
}
