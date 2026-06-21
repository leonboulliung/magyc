"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { PromptComposer } from "@/components/PromptComposer";
import { MoodGradient } from "@/components/MoodGradient";
import { ProjectCardActions } from "@/components/studio/ProjectCardActions";
import {
  readApiJson,
  showActionError,
  showActionLoading,
  showActionSuccess,
} from "@/lib/client/feedback";
import {
  cleanStudioPresets,
  DEFAULT_STUDIO_PRESETS,
  STUDIO_PRESETS_STORAGE_KEY,
  type StudioPreset,
} from "@/lib/studioPresets";

export interface StudioProjectCard {
  id: string;
  title: string;
  stage: "brief" | "production" | "handoff" | null;
  createdAt: number;
  shared: boolean;
}

const STAGE_LABEL: Record<"brief" | "production" | "handoff", string> = {
  brief: "Planung",
  production: "Absegnung",
  handoff: "Abschluss",
};

function relTime(ts: number): string {
  const d = Math.max(0, Date.now() - ts);
  const day = 86_400_000;
  if (d < day) return "heute";
  const days = Math.floor(d / day);
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.floor(days / 30);
  return months === 1 ? "vor 1 Monat" : `vor ${months} Monaten`;
}

export function StudioHome({
  projects,
  archived = [],
  deleted = [],
}: {
  projects: StudioProjectCard[];
  archived?: StudioProjectCard[];
  deleted?: StudioProjectCard[];
}) {
  const router = useRouter();
  const { user } = useUser();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState<StudioPreset[]>([]);
  const [presetId, setPresetId] = useState("none");
  const [fastPrompts, setFastPrompts] = useState<string[]>([]);
  const [fpOpen, setFpOpen] = useState(false);

  const usablePresets = useMemo(() => presets.filter((p) => p.modules.length > 0), [presets]);
  const selectedPreset = usablePresets.find((p) => p.id === presetId) || null;
  const greetingName = user?.firstName || user?.username || null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let local: StudioPreset[] | null = null;
      try {
        const raw = window.localStorage.getItem(STUDIO_PRESETS_STORAGE_KEY);
        local = cleanStudioPresets(raw ? JSON.parse(raw) : null);
      } catch { /* presets are an accelerator */ }
      try {
        const res = await fetch("/api/studio/presets", { cache: "no-store" });
        const json = await readApiJson(res) as { presets?: unknown };
        const remote = cleanStudioPresets(json.presets) ?? [];
        if (!cancelled) setPresets(remote.length ? remote : DEFAULT_STUDIO_PRESETS);
      } catch {
        if (!cancelled) setPresets(local && local.length ? local : DEFAULT_STUDIO_PRESETS);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/studio/profile", { cache: "no-store" });
        const json = await readApiJson(res) as { profile?: { settings?: { fastPrompts?: unknown } } };
        const fps = json?.profile?.settings?.fastPrompts;
        if (!cancelled && Array.isArray(fps)) setFastPrompts(fps.filter((x): x is string => typeof x === "string"));
      } catch { /* optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function create() {
    if (busy) return;
    setBusy(true);
    showActionLoading("Projekt wird erstellt …", "create-project");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          segment: selectedPreset?.id || "product",
          prompt,
          presetName: selectedPreset?.name,
          presetModules: selectedPreset?.modules,
          presetPromptInjections: selectedPreset?.promptInjections,
          presetAllowContextModules: selectedPreset?.allowContextModules,
        }),
      });
      const json = await readApiJson(res) as { id?: string };
      if (!res.ok || !json?.id) {
        showActionError("Projekt nicht erstellt", { id: "create-project", description: "Bitte erneut versuchen." });
        setBusy(false);
        return;
      }
      showActionSuccess("Projekt erstellt", { id: "create-project", description: "Die Planung wird geöffnet." });
      router.push(`/studio/${json.id}`);
    } catch {
      showActionError("Projekt nicht erstellt", { id: "create-project", description: "Netzwerkfehler. Bitte erneut versuchen." });
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      {/* Prompt-first hero — the create field is the centre of the Studio */}
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/40">Studio</p>
      <h1 className="mt-3 font-brand text-[30px] font-bold tracking-[-0.02em] text-white sm:text-[40px]">
        {greetingName ? `Was planen wir, ${greetingName}?` : "Was planen wir?"}
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/55">
        Beschreib dein Shooting in einem Satz. MAGYC macht aus deiner Idee einen klaren,
        greifbaren Plan — den Rest schärfst du gemeinsam.
      </p>

      <div className="mt-7">
        <PromptComposer
          value={prompt}
          onChange={setPrompt}
          onSubmit={create}
          autoFocus
          rows={3}
          placeholder="z. B. Produktshooting für eine handgemachte Keramik-Serie, clean und warm …"
          topSlot={
            <div className="flex flex-wrap gap-2">
              <PresetChip active={presetId === "none"} onClick={() => setPresetId("none")} label="Ohne Preset" />
              {usablePresets.map((p) => (
                <PresetChip key={p.id} active={presetId === p.id} onClick={() => setPresetId(p.id)} label={p.name} />
              ))}
            </div>
          }
          footer={
            <Link href="/studio/new" className="mono text-[11px] uppercase tracking-widest text-white/45 transition-colors hover:text-white/80">
              Mehr Optionen
            </Link>
          }
        />

        {/* Fast-Prompts — collapsible so many snippets stay fully readable
            without crowding the field. Click to drop into the prompt. */}
        {fastPrompts.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setFpOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span className="mono text-[11px] uppercase tracking-widest text-white/50">
                Schnellbausteine <span className="text-white/30">({fastPrompts.length})</span>
              </span>
              <span className="text-white/40 transition-transform" style={{ transform: fpOpen ? "rotate(180deg)" : "none" }}>⌄</span>
            </button>
            {fpOpen && (
              <div className="max-h-72 overflow-y-auto border-t border-white/10">
                {fastPrompts.map((fp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPrompt((p) => (p.trim() ? `${p.trimEnd()}\n${fp}` : fp))}
                    className="flex w-full items-start gap-2.5 border-b border-white/[0.06] px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-white/[0.04]"
                  >
                    <span className="mono mt-0.5 text-[12px] leading-none text-white/30">⌁</span>
                    <span className="text-[13.5px] leading-snug text-white/75">{fp}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Projects */}
      <div className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <p className="mono text-[11px] uppercase tracking-[0.2em] text-white/40">Deine Projekte</p>
          {projects.length > 0 && (
            <span className="mono text-[11px] tabular-nums text-white/30">{projects.length}</span>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 p-8 text-center sm:p-12">
            <MoodGradient seed="willkommen" className="absolute inset-0 opacity-50" />
            <div className="absolute inset-0 bg-black/55" />
            <div className="relative">
              <p className="font-brand text-[20px] font-bold text-white">Noch kein Projekt</p>
              <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-white/65">
                Schreib oben deine Idee — der erste Plan steht in Sekunden.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => <ProjectCard key={p.id} p={p} context="active" />)}
          </div>
        )}

        {/* Archive + trash — collapsible so they never crowd the active work. */}
        {archived.length > 0 && (
          <Accordion title="Archiviert" count={archived.length} items={archived} context="archived" />
        )}
        {deleted.length > 0 && (
          <Accordion title="Papierkorb" count={deleted.length} items={deleted} context="deleted" note="30 Tage wiederherstellbar" />
        )}
      </div>
    </div>
  );
}

function ProjectCard({ p, context }: { p: StudioProjectCard; context: "active" | "archived" | "deleted" }) {
  const dim = context !== "active";
  return (
    <div className={`group relative ${dim ? "opacity-75" : ""}`}>
      <Link
        href={`/studio/${p.id}`}
        className="block h-44 transform-gpu overflow-hidden rounded-2xl border border-white/10 transition-transform hover:-translate-y-0.5"
      >
        <MoodGradient seed={p.id} className={`absolute inset-0 transition-transform duration-500 group-hover:scale-105 ${dim ? "saturate-[0.6]" : ""}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-4">
          <span className="mono text-[10px] uppercase tracking-widest text-white/70">
            {p.stage ? STAGE_LABEL[p.stage] : "Projekt"}
          </span>
          <span className="mt-1 line-clamp-2 text-[16px] font-medium leading-snug text-white">
            {p.title || "Unbenanntes Projekt"}
          </span>
          <span className="mt-1 text-[12px] text-white/55">{relTime(p.createdAt)}</span>
        </div>
      </Link>
      <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <ProjectCardActions id={p.id} shared={p.shared} context={context} />
      </div>
    </div>
  );
}

function Accordion({
  title,
  count,
  note,
  items,
  context,
}: {
  title: string;
  count: number;
  note?: string;
  items: StudioProjectCard[];
  context: "archived" | "deleted";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="mono text-[11px] uppercase tracking-widest text-white/50">
          {title} <span className="text-white/30">({count})</span>
          {note && <span className="ml-2 normal-case tracking-normal text-white/25">· {note}</span>}
        </span>
        <span className="text-white/40 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => <ProjectCard key={p.id} p={p} context={context} />)}
        </div>
      )}
    </div>
  );
}

function PresetChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[12px] tracking-wide transition-colors"
      style={{
        border: "1px solid",
        borderColor: active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.14)",
        background: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.03)",
        color: active ? "#fff" : "rgba(255,255,255,0.7)",
      }}
    >
      {label}
    </button>
  );
}
