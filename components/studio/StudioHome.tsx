"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { PromptStart } from "@/components/create/PromptStart";
import { ClarifyModuleStep } from "@/components/clarify/ClarifyModuleStep";
import { BuildingScreen } from "@/components/home/BuildingScreen";
import { MoodGradient } from "@/components/MoodGradient";
import { ProjectCardActions } from "@/components/studio/ProjectCardActions";
import { ProjectInvitations } from "@/components/studio/ProjectInvitations";
import {
  readApiJson,
  showActionError,
  showActionLoading,
  showActionSuccess,
} from "@/lib/client/feedback";
import { apiError, fetchJsonWithTimeout, formatFlowError } from "@/lib/home/flow";
import { getAnonToken } from "@/lib/anonId";
import { stagePage, chipGrid, clarifyItem } from "@/lib/anim";
import type { ClarifyStep, Module } from "@/lib/types";
import type { ProjectModeId } from "@/lib/projectModes";
import {
  cleanStudioPresets,
  STUDIO_PRESETS_STORAGE_KEY,
  type StudioPreset,
} from "@/lib/studioPresets";
import { cleanFastPrompts, type FastPrompt } from "@/lib/studioProfile";
import { withClarifyAnswer } from "@/lib/createPipeline";

export interface StudioProjectCard {
  id: string;
  title: string;
  stage: "brief" | "production" | "handoff" | null;
  createdAt: number;
  lastActivityAt: number;
  shared: boolean;
  stateCount: number;
  uploadCount: number;
  memberCount: number;
  accessRole: "owner" | "editor" | "client";
}

const STAGE_LABEL: Record<"brief" | "production" | "handoff", string> = {
  brief: "Planung",
  production: "Vertrag",
  handoff: "Abgeschlossen",
};

type CreateStage = "input" | "clarify" | "building";

interface Answer {
  questionId: string;
  questionText: string;
  choice: string;
}

const CLARIFY_TIMEOUT_MS = 25_000;
const BUILD_TIMEOUT_MS = 45_000;

const slideVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 28 : -28,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.32, ease: "easeOut" as const },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -28 : 28,
    transition: { duration: 0.2, ease: "easeIn" as const },
  }),
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prompt, setPrompt] = useState("");
  const projectMode: ProjectModeId = "photo_shoot";
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<CreateStage>("input");
  const [steps, setSteps] = useState<ClarifyStep[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState<Record<string, Module | null>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [customDraft, setCustomDraft] = useState("");
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [comingToLife, setComingToLife] = useState("");
  const [promptNudge, setPromptNudge] = useState(false);
  const [presets, setPresets] = useState<StudioPreset[]>([]);
  const [presetId, setPresetId] = useState("none");
  const [fastPrompts, setFastPrompts] = useState<FastPrompt[]>([]);
  const [defaultLanguage, setDefaultLanguage] = useState("de");

  const selectedPreset = useMemo(() => presets.find((p) => p.id === presetId) || null, [presetId, presets]);
  const totalSteps = steps.length;
  const currentStep: ClarifyStep | null = steps[stepIndex] ?? null;
  const isLastStep = stepIndex === totalSteps - 1;
  const currentAnswer = currentStep ? answers[currentStep.id] : undefined;
  const isCustom =
    currentStep?.kind === "choice" &&
    currentAnswer != null &&
    !currentStep.options.some((o) => o.value === currentAnswer);
  const progress = totalSteps > 0 ? stepIndex / totalSteps : 0;

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
        if (!cancelled) setPresets(remote);
      } catch {
        if (!cancelled) setPresets(local ?? []);
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
        const json = await readApiJson(res) as { profile?: { settings?: { fastPrompts?: unknown; defaultLanguage?: unknown } } };
        const fps = cleanFastPrompts(json?.profile?.settings?.fastPrompts);
        if (!cancelled) {
          setFastPrompts(fps);
          const language = json?.profile?.settings?.defaultLanguage;
          setDefaultLanguage(typeof language === "string" ? language : "de");
        }
      } catch { /* optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  function focusPrompt() {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 160);
    });
  }

  function nudgePrompt() {
    setPromptNudge(true);
    window.setTimeout(() => setPromptNudge(false), 900);
    focusPrompt();
  }

  function submitInput() {
    if (busy) return;
    if (prompt.trim().length < 3) {
      nudgePrompt();
      return;
    }
    void goClarify();
  }

  function addPromptHint(hint: string) {
    setPrompt((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n${hint}` : hint;
    });
    focusPrompt();
  }

  async function goClarify() {
    if (busy) return;
    const trimmed = prompt.trim();
    if (trimmed.length < 3) return;
    setBusy(true);
    setError("");
    setStatusText("Rückfragen werden vorbereitet …");
    try {
      const { res, json } = await fetchJsonWithTimeout("/api/spaces/clarify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: trimmed,
          projectMode,
          language: defaultLanguage,
          anonToken: getAnonToken(),
        }),
      }, CLARIFY_TIMEOUT_MS);
      if (!res.ok) {
        setError(formatFlowError(apiError(json, res.status), json as { retryInSeconds?: unknown }));
        return;
      }
      const nextSteps = Array.isArray(json.steps) ? json.steps : [];
      setComingToLife(typeof json.comingToLife === "string" ? json.comingToLife : "");
      if (nextSteps.length === 0) {
        // The input already answers what the build needs — clarify returned no
        // gaps, so skip the questions and build directly.
        setSteps([]);
        setAnswers({});
        setConfigured({});
        await goBuild(true);
        return;
      }
      setSteps(nextSteps);
      setComingToLife(typeof json.comingToLife === "string" ? json.comingToLife : "");
      setAnswers({});
      setConfigured({});
      setStepIndex(0);
      setDirection(1);
      setCustomDraft("");
      setStage("clarify");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "clarify_failed";
      setError(formatFlowError(message));
    } finally {
      setBusy(false);
      setStatusText("");
    }
  }

  function pickAnswer(stepId: string, value: string) {
    setAnswers((a) => ({ ...a, [stepId]: value }));
    setCustomDraft("");
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      goForward();
    }, 500);
  }

  function goForward() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (stepIndex < totalSteps - 1) {
      setDirection(1);
      setStepIndex((i) => i + 1);
      setCustomDraft("");
    } else {
      void goBuild();
    }
  }

  function goBack() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (stepIndex > 0) {
      setDirection(-1);
      setStepIndex((i) => i - 1);
      setCustomDraft("");
    } else {
      setStage("input");
      setAnswers({});
    }
  }

  // `force` is used by the no-questions path: clarify is still holding `busy`
  // when it hands off, and there is no clarify screen to fall back to on error.
  async function goBuild(force = false) {
    if (!force && busy) return;
    setBusy(true);
    setStage("building");
    setError("");
    setStatusText("Projekt wird erstellt …");
    showActionLoading("Projekt wird erstellt …", "create-project");

    const payloadAnswers: Answer[] = steps
      .filter((s) => s.kind === "choice" || s.kind === "text")
      .filter((s) => answers[s.id])
      .map((s) => ({ questionId: s.id, questionText: s.text, choice: answers[s.id] }));
    const configuredModules = steps
      .filter((s) => s.kind === "module")
      .map((s) => configured[s.id])
      .filter(Boolean);

    try {
      const { res, json } = await fetchJsonWithTimeout("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          segment: selectedPreset?.id || projectMode || "product",
          prompt,
          projectMode,
          answers: payloadAnswers,
          configuredModules,
          presetName: selectedPreset?.name,
          presetId: selectedPreset?.id,
          presetModules: selectedPreset?.modules,
          presetPromptInjections: selectedPreset?.promptInjections,
          presetAllowContextModules: selectedPreset?.allowContextModules,
        }),
      }, BUILD_TIMEOUT_MS);
      const id = typeof json.id === "string" ? json.id : "";
      if (!res.ok || !id) {
        const description = formatFlowError(apiError(json, res.status), json as { retryInSeconds?: unknown });
        showActionError("Projekt nicht erstellt", { id: "create-project", description });
        setError(description);
        setStage(force ? "input" : "clarify");
        return;
      }
      showActionSuccess("Projekt erstellt", { id: "create-project", description: "Die Planung wird geöffnet." });
      router.push(`/project/${id}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "classify_failed";
      const description = formatFlowError(message);
      showActionError("Projekt nicht erstellt", { id: "create-project", description });
      setError(description);
      setStage(force ? "input" : "clarify");
    } finally {
      setBusy(false);
      setStatusText("");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      {/* Prompt-first hero — the create field is the centre of the Studio */}
      <h1 className="font-brand text-[30px] font-bold tracking-[-0.02em] text-[#17171a] sm:text-[40px]">
        Plane deinen nächsten Fotografie-Auftrag
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-black/55">
        Füge die Kundenanfrage ein — Nachricht oder E-Mail. Oder beschreibe das Shooting
        selbst: Standort(e), beteiligte Personen, Ziel, Ablaufphasen und geplante Termine.
      </p>

      <div className="mt-7">
        <AnimatePresence mode="wait" initial={false}>
          {stage === "input" && (
            <motion.div
              key="input"
              variants={stagePage}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <PromptStart
                inputRef={inputRef}
                value={prompt}
                onChange={(v) => { setPromptNudge(false); setPrompt(v); }}
                onSubmit={submitInput}
                disabled={busy}
                autoFocus
                rows={5}
                highlight={promptNudge}
                presets={presets}
                selectedPresetId={presetId}
                onPresetChange={(id) => { setPresetId(id); focusPrompt(); }}
                fastPrompts={fastPrompts}
                onFastPrompt={addPromptHint}
              />
            </motion.div>
          )}

          {stage === "clarify" && currentStep && (
            <motion.div
              key="clarify"
              variants={stagePage}
              initial="hidden"
              animate="show"
              exit="exit"
              className="rounded-[34px] bg-white p-5 text-[#17171a] sm:p-9"
              style={{
                border: "1px solid var(--studio-rule)",
                boxShadow: "0 18px 70px rgba(0,0,0,0.18)",
                ["--v-radius" as string]: "28px",
                ["--v-bg" as string]: "var(--studio-surface-soft)",
                ["--v-fg" as string]: "var(--studio-ink)",
                ["--v-muted" as string]: "var(--studio-muted)",
                ["--v-rule" as string]: "var(--studio-rule)",
                ["--v-accent" as string]: "var(--studio-ink)",
              }}
            >
              <div className="mb-8 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="mono text-[9px] tracking-widest opacity-40 tabular-nums">
                    {stepIndex + 1} / {totalSteps}
                  </span>
                  <button
                    onClick={() => goBuild()}
                    disabled={busy}
                    className="mono text-[9px] tracking-widest opacity-30 hover:opacity-60 disabled:opacity-20"
                  >
                    {hasAnyAnswer(answers, configured) ? "Überspringen" : "Alle überspringen"}
                  </button>
                </div>
                <div
                  className="w-full overflow-hidden rounded-full"
                  style={{ height: 2, background: "var(--studio-rule)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "var(--studio-ink)" }}
                    initial={false}
                    animate={{ width: `${Math.max(progress * 100, 4)}%` }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>

              <div className="overflow-hidden" style={{ minHeight: 220 }}>
                <AnimatePresence custom={direction} mode="wait" initial={false}>
                  <motion.div
                    key={currentStep.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-5"
                  >
                    <p className="mono truncate text-[10px] tracking-widest opacity-30" title={prompt.trim()}>
                      {prompt.trim()}
                    </p>

                    {currentStep.kind === "module" ? (
                      <ClarifyModuleStep
                        prefill={currentStep}
                        value={configured[currentStep.id] ?? null}
                        onChange={(mod) => setConfigured((c) => ({ ...c, [currentStep.id]: mod }))}
                      />
                    ) : currentStep.kind === "text" ? (
                      <>
                        <motion.h3
                          className="text-[18px] font-medium leading-snug sm:text-[22px]"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.32, ease: "easeOut", delay: 0.15 }}
                        >
                          {currentStep.text}
                        </motion.h3>
                        <textarea
                          autoFocus
                          value={currentAnswer ?? ""}
                          onChange={(e) => setAnswers((a) => ({ ...a, [currentStep.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              goForward();
                            }
                          }}
                          rows={3}
                          maxLength={currentStep.maxLength ?? 240}
                          placeholder={currentStep.placeholder ?? "Beschreibe deine Antwort kurz …"}
                          className="w-full resize-none rounded-[28px] p-4 text-[16px] leading-relaxed outline-none placeholder:text-black/28"
                          style={{ border: "1px solid var(--studio-rule)", background: "var(--studio-surface-soft)", color: "var(--studio-ink)" }}
                        />
                      </>
                    ) : (
                      <>
                        <motion.h3
                          className="flex items-baseline gap-2 text-[18px] font-medium leading-snug sm:text-[22px]"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.32, ease: "easeOut", delay: 0.15 }}
                        >
                          {currentStep.category === "data" && (
                            <span aria-hidden className="mono text-[11px] tracking-widest opacity-40">◆</span>
                          )}
                          <span>{currentStep.text}</span>
                        </motion.h3>

                        <motion.div className="flex flex-wrap gap-2" initial="hidden" animate="show" variants={chipGrid}>
                          {currentStep.options.map((o) => {
                            const picked = currentAnswer === o.value;
                            return (
                              <motion.button
                                key={o.value}
                                variants={clarifyItem}
                                onClick={() => pickAnswer(currentStep.id, o.value)}
                                className="mono rounded-full px-3 py-1.5 text-[11px] tracking-widest"
                                style={{
                                  border: "1px solid",
                                  borderColor: picked ? "var(--studio-ink)" : "var(--studio-rule)",
                                  background: picked ? "var(--studio-ink)" : "var(--studio-surface-soft)",
                                  color: picked ? "var(--studio-page)" : "var(--studio-ink)",
                                }}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.96 }}
                                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                              >
                                {o.value}
                              </motion.button>
                            );
                          })}
                          <input
                            type="text"
                            value={customDraft}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCustomDraft(v);
                              setAnswers((a) => withClarifyAnswer(a, currentStep.id, v));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && customDraft.trim()) goForward();
                            }}
                            placeholder="Eigene Antwort"
                            maxLength={120}
                            className="mono rounded-full bg-transparent px-3 py-1.5 text-[11px] tracking-widest outline-none"
                            style={{
                              border: "1px solid",
                              borderColor: isCustom ? "var(--studio-ink)" : "var(--studio-rule)",
                              color: "var(--studio-ink)",
                              minWidth: "80px",
                            }}
                          />
                        </motion.div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <motion.button
                  onClick={goBack}
                  className="mono text-[12px] tracking-widest opacity-40 hover:opacity-80"
                  whileHover={{ x: -3 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  ←
                </motion.button>
                <motion.button
                  onClick={goForward}
                  disabled={busy}
                  aria-label={isLastStep ? "Projekt erstellen" : "Nächste Rückfrage"}
                  className="mono rounded-full bg-[#17171a] px-5 py-2 text-[11px] tracking-widest text-white disabled:opacity-30"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {busy ? "…" : "→"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {stage === "building" && (
            <motion.div
              key="building"
              variants={stagePage}
              initial="hidden"
              animate="show"
              exit="exit"
              className="rounded-[20px] bg-white py-16"
              style={{ border: "1px solid rgba(0,0,0,0.12)", boxShadow: "0 12px 50px rgba(0,0,0,0.08)" }}
            >
              <BuildingScreen inputText={prompt} comingToLife={comingToLife} statusText={statusText} />
            </motion.div>
          )}
        </AnimatePresence>

        {error && stage !== "building" && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mono mt-6 text-[10px] tracking-widest text-black/55"
          >
            {error}
          </motion.p>
        )}
      </div>

      {/* Projects */}
      {stage === "input" && <div className="mt-12">
        <ProjectInvitations />
        <div className="mb-4 flex items-center justify-between">
          <p className="mono text-[11px] uppercase tracking-[0.2em] text-black/45">Deine Projekte</p>
          {projects.length > 0 && (
            <span className="mono text-[11px] tabular-nums text-black/35">{projects.length}</span>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-black/10 p-8 text-center sm:p-12">
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
      </div>}
    </div>
  );
}

function ProjectCard({ p, context }: { p: StudioProjectCard; context: "active" | "archived" | "deleted" }) {
  const dim = context !== "active";
  return (
    <div className={`group relative origin-center transform-gpu rounded-2xl transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.015] hover:shadow-[0_14px_34px_rgba(0,0,0,0.13)] ${dim ? "opacity-75" : ""}`}>
      <Link
        href={`/project/${p.id}`}
        className="block h-44 transform-gpu overflow-hidden rounded-2xl border border-black/10"
      >
        <MoodGradient seed={p.id} className={`absolute inset-0 transition-transform duration-500 group-hover:scale-[1.02] ${dim ? "saturate-[0.6]" : ""}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-4">
          <span className="mono text-[10px] uppercase tracking-widest text-white/70">
            {p.stage ? STAGE_LABEL[p.stage] : "Projekt"}
          </span>
          <span className="mt-1 line-clamp-2 text-[16px] font-medium leading-snug text-white">
            {p.title || "Unbenanntes Projekt"}
          </span>
          <span className="mt-1 text-[12px] text-white/55">Aktiv {relTime(p.lastActivityAt)}</span>
          {(p.memberCount > 0 || p.uploadCount > 0) && (
            <span className="mono mt-2 text-[9px] uppercase tracking-widest text-white/45">
              {p.memberCount > 0 ? `${p.memberCount} Beteiligte` : ""}
              {p.memberCount > 0 && p.uploadCount > 0 ? " · " : ""}
              {p.uploadCount > 0 ? `${p.uploadCount} Uploads` : ""}
            </span>
          )}
        </div>
      </Link>
      {p.accessRole === "owner" ? (
        <div className="absolute right-2 top-2">
          <ProjectCardActions id={p.id} title={p.title} shared={p.shared} context={context} />
        </div>
      ) : (
        <span className="mono absolute right-2 top-2 rounded-full border border-white/15 bg-black/72 px-2 py-1 text-[9px] uppercase tracking-widest text-white/65">
          {p.accessRole === "editor" ? "Du bist im Team" : "Du bist Kund:in"}
        </span>
      )}
    </div>
  );
}

function hasAnyAnswer(answers: Record<string, string>, configured: Record<string, Module | null>): boolean {
  return Object.values(answers).some((value) => value.trim().length > 0) ||
    Object.values(configured).some(Boolean);
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
    <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-black/[0.03]"
      >
        <span className="mono text-[10px] uppercase tracking-widest text-black/55">
          {title} <span className="text-black/35">({count})</span>
          {note && <span className="ml-2 normal-case tracking-normal text-black/30">· {note}</span>}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-black/10 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => <ProjectCard key={p.id} p={p} context={context} />)}
        </div>
      )}
    </div>
  );
}

/** A chevron that rotates around its own centre — no glyph baseline shift, so
 *  the accordion header height stays fixed whether open or closed. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden
      className="shrink-0 text-black/40 transition-transform duration-200"
      style={{ transform: open ? "rotate(180deg)" : "none" }}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
