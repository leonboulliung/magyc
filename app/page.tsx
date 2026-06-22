"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { getAnonToken, rememberSpaceOwnerToken } from "@/lib/anonId";
import { stagePage, chipGrid, clarifyItem } from "@/lib/anim";
import type { ClarifyStep, Module } from "@/lib/types";
import { ClarifyModuleStep } from "@/components/clarify/ClarifyModuleStep";
import { PromptComposer } from "@/components/PromptComposer";
import { DotField, type DotFieldHandle } from "@/components/DotField";
import { EnterKey } from "@/components/EnterKey";
import { PROJECT_MODES, projectModeById, type ProjectModeId } from "@/lib/projectModes";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { EmergentBackdrop } from "@/components/site/EmergentBackdrop";
import { BuildingScreen } from "@/components/home/BuildingScreen";
import { apiError, fetchJsonWithTimeout, formatFlowError } from "@/lib/home/flow";

type Stage = "input" | "clarify" | "building";

interface Answer {
  questionId: string;
  questionText: string;
  choice: string;
}

const CLARIFY_TIMEOUT_MS = 25_000;
const BUILD_TIMEOUT_MS = 45_000;

const DEFAULT_EXAMPLES: { prompt: string; mode?: ProjectModeId }[] = [
  { prompt: "Plan a fashion shoot in Berlin.", mode: "photo_shoot" },
  { prompt: "Create a launch plan for a neighborhood cafe.", mode: "campaign" },
  { prompt: "Organize a podcast episode with guests and production tasks." },
];

const DEFAULT_ASSIST_CHIPS: { label: string; text: string }[] = [
  { label: "Add locations?", text: "Include useful locations or place suggestions." },
  { label: "Need roles?", text: "Add roles and responsibilities for the people involved." },
  { label: "Want a timeline?", text: "Turn this into a clear timeline." },
  { label: "Add deliverables?", text: "Include concrete deliverables and approval points." },
];

const HOME_WORK_IMAGES = [
  { src: "/media/showcase-10.jpg", alt: "Luxusuhr auf dunklem Grund", label: "Produkt" },
  { src: "/media/showcase-03.jpg", alt: "Editorial-Portraet mit schwarzem Blazer", label: "Editorial" },
  { src: "/media/showcase-05.jpg", alt: "Event in einer grossen Halle", label: "Event" },
  { src: "/media/showcase-02.jpg", alt: "Skincare-Stillleben mit Palmblatt", label: "Stilllife" },
];

/**
 * Read a human error string out of an API (or Vercel platform) error
 * body. Vercel's own errors (504 timeout, function crash) return
 * `error` as an OBJECT { code, message } — String()'ing that yields the
 * useless "[object Object]". This unwraps any shape into readable text.
 */
/** Slide variants for the per-step transition. */
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

export default function HomePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("input");
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState("");
  const [projectMode, setProjectMode] = useState<ProjectModeId | null>(null);
  const [, setLanguage] = useState("en");
  // AI-authored "bringing your idea to life" line for the build screen.
  const [comingToLife, setComingToLife] = useState("");
  // One ordered list of typed clarify steps (choice | text | module).
  const [steps, setSteps] = useState<ClarifyStep[]>([]);
  // Answers to choice/text steps, keyed by step id.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Configured modules from "module" steps, keyed by step id.
  const [configured, setConfigured] = useState<Record<string, Module | null>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [customDraft, setCustomDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [promptNudge, setPromptNudge] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotFieldRef = useRef<DotFieldHandle>(null);
  const enterKeyRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedMode = projectModeById(projectMode);
  const promptExamples = selectedMode
    ? selectedMode.examples.map((prompt) => ({ prompt, mode: selectedMode.id }))
    : DEFAULT_EXAMPLES;
  const assistChips = selectedMode?.assistChips ?? DEFAULT_ASSIST_CHIPS;

  useEffect(() => {
    setMounted(true);
  }, []);

  // The landing page is a fixed, full-screen surface — there is nothing
  // to scroll. Lock the document while it's mounted so mobile browsers
  // don't show a phantom scrollbar or rubber-band overscroll (which also
  // resized the canvas and made the dot grid jump). Restored on navigate.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      overscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.overscroll;
    };
  }, []);

  // The prompt box grows with its content instead of being a fixed,
  // mostly-empty block — but only up to ~40% of the viewport, after which
  // it scrolls internally. Without the cap, long text on the fixed,
  // overflow-hidden page pushes its own bottom (and the Enter key) off
  // screen with no way to scroll to it.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      const max = Math.max(120, Math.round(window.innerHeight * 0.4));
      const next = Math.min(el.scrollHeight, max);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [text, stage]);

  /** Viewport centre of an element (or screen centre as fallback). */
  function originOf(el: HTMLElement | null): { x: number; y: number } {
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  /** Input-stage submit: wave from the Enter key + keep the grid
   *  pulsing through the AI wait, then clarify. */
  function submitInput() {
    if (busy || text.trim().length < 3) return;
    const o = originOf(enterKeyRef.current);
    dotFieldRef.current?.ripple(o.x, o.y);
    dotFieldRef.current?.setThinking(true, o.x, o.y);
    goClarify();
  }

  function promptOrSubmit() {
    if (text.trim().length < 3) {
      nudgePrompt();
      return;
    }
    submitInput();
  }

  function nudgePrompt() {
    setPromptNudge(true);
    window.setTimeout(() => setPromptNudge(false), 900);
    focusPrompt();
  }

  function focusPrompt() {
    window.requestAnimationFrame(() => {
      document.getElementById("start")?.scrollIntoView({ block: "center", behavior: "smooth" });
      inputRef.current?.focus({ preventScroll: true });
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 160);
    });
  }

  function toggleProjectMode(id: ProjectModeId) {
    setProjectMode((current) => (current === id ? null : id));
    focusPrompt();
  }

  function applyExample(prompt: string, mode?: ProjectModeId) {
    if (mode) setProjectMode(mode);
    setText(prompt);
    focusPrompt();
  }

  function addPromptHint(hint: string) {
    setText((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n${hint}` : hint;
    });
    focusPrompt();
  }

  // Clean up auto-advance timer on unmount
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  async function goClarify() {
    if (busy) return;
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    setBusy(true);
    setError("");
    setStatusText("Thinking through the first questions…");
    try {
      const { res, json } = await fetchJsonWithTimeout("/api/spaces/clarify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: trimmed, projectMode, anonToken: getAnonToken() }),
      }, CLARIFY_TIMEOUT_MS);
      if (!res.ok) {
        setError(formatFlowError(apiError(json, res.status), json as { retryInSeconds?: unknown }));
        return;
      }
      const nextSteps = Array.isArray(json.steps) ? json.steps : [];
      if (nextSteps.length === 0) {
        setError("No clarification steps came back. Please try again.");
        return;
      }
      setSteps(nextSteps);
      setLanguage(json.language || "en");
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
      dotFieldRef.current?.setThinking(false);
    }
  }

  const totalSteps = steps.length;
  const currentStep: ClarifyStep | null = steps[stepIndex] ?? null;

  function pickAnswer(stepId: string, value: string) {
    setAnswers((a) => ({ ...a, [stepId]: value }));
    setCustomDraft("");
    // Auto-advance after a brief pause so the user sees the selection
    // highlight before it slides away. Only chips auto-advance — typing
    // (custom input, text steps) must not yank the step away.
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
      goBuild();
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

  async function goBuild() {
    if (busy) return;
    // Final commit — the grid answers from the centre and keeps pulsing
    // through the build wait.
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    dotFieldRef.current?.ripple(cx, cy);
    dotFieldRef.current?.setThinking(true, cx, cy);
    setBusy(true);
    setStage("building");
    setError("");
    setStatusText("Building your space…");
    // Choice + text steps become Q&A pairs; module steps become
    // pre-configured Modules. The classifier consumes both unchanged.
    const payloadAnswers: Answer[] = steps
      .filter((s) => s.kind === "choice" || s.kind === "text")
      .filter((s) => answers[s.id])
      .map((s) => ({ questionId: s.id, questionText: s.text, choice: answers[s.id] }));
    const configuredModules = steps
      .filter((s) => s.kind === "module")
      .map((s) => configured[s.id])
      .filter(Boolean);
    try {
      const { res, json } = await fetchJsonWithTimeout("/api/spaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: text.trim(),
          projectMode,
          answers: payloadAnswers,
          configuredModules,
          anonToken: getAnonToken(),
        }),
      }, BUILD_TIMEOUT_MS);
      if (!res.ok) {
        setError(formatFlowError(apiError(json, res.status), json as { retryInSeconds?: unknown }));
        setStage("clarify");
        setBusy(false);
        setStatusText("");
        dotFieldRef.current?.setThinking(false);
        return;
      }
      if (json.anonOwnerToken) rememberSpaceOwnerToken(json.id, json.anonOwnerToken);
      // Keep pulsing — navigation unmounts the page on success.
      router.push(`/s/${json.id}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "classify_failed";
      setError(formatFlowError(message));
      setStage("clarify");
      setBusy(false);
      setStatusText("");
      dotFieldRef.current?.setThinking(false);
    }
  }

  const progress = totalSteps > 0 ? stepIndex / totalSteps : 0;
  const isLastStep = stepIndex === totalSteps - 1;
  const currentAnswer = currentStep ? answers[currentStep.id] : undefined;
  const isCustom =
    currentStep?.kind === "choice" &&
    currentAnswer != null &&
    !currentStep.options.some((o) => o.value === currentAnswer);

  return (
    <main
      className="fixed inset-0 flex flex-col overflow-hidden bg-black font-body text-white"
      style={{ overscrollBehavior: "none" }}
    >
      {stage === "input" ? (
        <>
          <EmergentBackdrop />
          <DotField ref={dotFieldRef} color="255,255,255" className="fixed inset-0 z-[1] opacity-[0.22]" />
        </>
      ) : (
        <div className="fixed inset-0 z-0 bg-black">
          <DotField ref={dotFieldRef} color="255,255,255" className="opacity-[0.18]" />
          <div className="absolute inset-0 bg-black/70" />
        </div>
      )}

      {/* The marketing top bar provides the single wordmark (top-left) on
          the input stage. The old marble wordmark here was a duplicate of
          the nav logo — removed to fix the double-logo on mobile. */}
      {stage === "input" && <SiteNav />}

      <div
        className={
          stage === "input"
            ? "relative z-30 min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-[132px] sm:px-8 sm:pt-[154px]"
            : "relative z-10 mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto overscroll-contain px-4 pb-8 sm:px-10"
        }
        style={stage === "input" ? undefined : { paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
      >
        <div
          className={
            stage === "input"
              ? "mx-auto flex w-full max-w-2xl flex-col gap-4"
              : "mx-auto mt-[clamp(24px,5vh,56px)] flex w-full max-w-3xl flex-col gap-[clamp(24px,5vh,56px)]"
          }
        >

          <AnimatePresence mode="wait" initial={false}>

            {stage === "input" && (
              <motion.div
                key="input"
                variants={stagePage}
                initial="hidden"
                animate="show"
                exit="exit"
                className={`flex flex-col gap-5 transition-all duration-1000 delay-300 ${
                  mounted ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
                }`}
              >
                <PromptComposer
                  id="start"
                  ref={inputRef}
                  className="scroll-mt-20"
                  value={text}
                  onChange={(v) => { setPromptNudge(false); setText(v); }}
                  onSubmit={submitInput}
                  disabled={busy}
                  autoFocus
                  rows={2}
                  highlight={promptNudge}
                  placeholder={selectedMode?.placeholder ?? "Describe a rough idea, project, or plan."}
                  topSlot={
                    <div className="flex flex-wrap gap-2">
                      {PROJECT_MODES.map((mode) => {
                        const picked = projectMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => toggleProjectMode(mode.id)}
                            disabled={busy}
                            className="font-body text-[11px] tracking-wide px-3 py-2 rounded transition-all disabled:opacity-30"
                            style={{
                              border: "1px solid",
                              borderColor: picked ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.14)",
                              background: picked ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.04)",
                              color: picked ? "#fff" : "rgba(255,255,255,0.72)",
                            }}
                          >
                            {mode.label}
                          </button>
                        );
                      })}
                    </div>
                  }
                  chips={
                    <div className="flex flex-wrap gap-2">
                      {text.trim().length === 0
                        ? promptExamples.map((example) => (
                            <button
                              key={`${example.mode ?? "free"}:${example.prompt}`}
                              type="button"
                              onClick={() => applyExample(example.prompt, example.mode)}
                              disabled={busy}
                              className="text-left text-[12px] sm:text-[13px] leading-snug px-3 py-2 rounded transition-all disabled:opacity-30 hover:bg-white/10"
                              style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.72)" }}
                            >
                              {example.prompt}
                            </button>
                          ))
                        : assistChips.map((chip) => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => addPromptHint(chip.text)}
                              disabled={busy}
                              className="mono text-[10px] sm:text-[11px] tracking-widest px-3 py-2 rounded transition-opacity disabled:opacity-30"
                              style={{ border: "1px dashed rgba(255,255,255,0.22)", background: "transparent", color: "rgba(255,255,255,0.64)" }}
                            >
                              {chip.label}
                            </button>
                          ))}
                    </div>
                  }
                  footer={!busy ? (
                    <p className="text-[13px] opacity-55 leading-relaxed">Start with a rough idea, a plan, or a prompt.</p>
                  ) : null}
                />

                {/* Enter key — simply bottom-right, below the card. */}
                <div className="flex flex-col items-end gap-3">
                  <EnterKey
                    ref={enterKeyRef}
                    onPress={submitInput}
                    disabled={busy || text.trim().length < 3}
                    busy={busy}
                  />
                  {statusText && (
                    <p className="mono text-[10px] tracking-widest opacity-60 text-right text-white">
                      {statusText}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {stage === "clarify" && currentStep && (
              <motion.div
                key="clarify"
                variants={stagePage}
                initial="hidden"
                animate="show"
                exit="exit"
                className="liquid-glass-strong rounded-[34px] p-5 text-white sm:p-9"
                style={{
                  background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 18px 70px rgba(0,0,0,0.36), inset 0 1px 1px rgba(255,255,255,0.12)",
                  ["--v-radius" as string]: "28px",
                  ["--v-bg" as string]: "rgba(255,255,255,0.06)",
                  ["--v-fg" as string]: "#ffffff",
                  ["--v-muted" as string]: "rgba(255,255,255,0.58)",
                  ["--v-rule" as string]: "rgba(255,255,255,0.18)",
                  ["--v-accent" as string]: "#ffffff",
                }}
              >
                {/* Progress bar + step counter */}
                <div className="mb-8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="mono text-[9px] tracking-widest opacity-40 tabular-nums">
                      {stepIndex + 1} / {totalSteps}
                    </span>
                    {/* Skip all → submit immediately */}
                    <button
                      onClick={goBuild}
                      disabled={busy}
                      className="mono text-[9px] tracking-widest opacity-30 hover:opacity-60 disabled:opacity-20"
                    >
                      skip all →
                    </button>
                  </div>
                  <div
                    className="w-full rounded-full overflow-hidden"
                    style={{ height: 2, background: "rgba(255,255,255,0.12)" }}
                  >
                    <motion.div
                      className="h-full rounded-full bg-white"
                      initial={false}
                      animate={{ width: `${Math.max(progress * 100, 4)}%` }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>

                {/* Single step — slides in/out */}
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
                      {/* The user's input as context — one quiet line,
                          cleanly elided (it's no longer load-bearing). */}
                      <p className="mono text-[10px] tracking-widest opacity-30 truncate" title={text.trim()}>
                        {text.trim()}
                      </p>

                      {currentStep.kind === "module" ? (
                        <ClarifyModuleStep
                          prefill={currentStep}
                          value={configured[currentStep.id] ?? null}
                          onChange={(mod) =>
                            setConfigured((c) => ({ ...c, [currentStep.id]: mod }))
                          }
                        />
                      ) : currentStep.kind === "text" ? (
                        <>
                          <motion.h3
                            className="text-[18px] sm:text-[22px] leading-snug font-medium"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.32, ease: "easeOut", delay: 0.15 }}
                          >
                            {currentStep.text}
                          </motion.h3>
                          <textarea
                            autoFocus
                            value={currentAnswer ?? ""}
                            onChange={(e) =>
                              setAnswers((a) => ({ ...a, [currentStep.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                goForward();
                              }
                            }}
                            rows={3}
                            maxLength={currentStep.maxLength ?? 240}
                            placeholder={currentStep.placeholder ?? "…"}
                            className="w-full resize-none rounded-[28px] bg-white/[0.04] p-4 text-[16px] leading-relaxed text-white outline-none placeholder:text-white/28"
                            style={{ border: "1px solid rgba(255,255,255,0.18)" }}
                          />
                        </>
                      ) : (
                        <>
                          <motion.h3
                            className="text-[18px] sm:text-[22px] leading-snug font-medium flex items-baseline gap-2"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.32, ease: "easeOut", delay: 0.15 }}
                          >
                            {currentStep.category === "data" && (
                              <span aria-hidden className="mono text-[11px] tracking-widest opacity-40">◆</span>
                            )}
                            <span>{currentStep.text}</span>
                          </motion.h3>

                          <motion.div
                            className="flex flex-wrap gap-2"
                            initial="hidden"
                            animate="show"
                            variants={chipGrid}
                          >
                            {currentStep.options.map((o) => {
                              const picked = currentAnswer === o.value;
                              return (
                                <motion.button
                                  key={o.value}
                                  variants={clarifyItem}
                                  onClick={() => pickAnswer(currentStep.id, o.value)}
                                  className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full"
                                  style={{
                                    border: "1px solid",
                                    borderColor: picked ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.18)",
                                    background: picked ? "#fff" : "rgba(255,255,255,0.035)",
                                    color: picked ? "#000" : "rgba(255,255,255,0.78)",
                                  }}
                                  whileHover={{ y: -2 }}
                                  whileTap={{ scale: 0.96 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                >
                                  {o.value}
                                </motion.button>
                              );
                            })}
                            {/* Custom text input */}
                            <input
                              type="text"
                              value={customDraft}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCustomDraft(v);
                                if (v.trim()) setAnswers((a) => ({ ...a, [currentStep.id]: v.trim() }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && customDraft.trim()) goForward();
                              }}
                              placeholder="…"
                              maxLength={120}
                              className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full bg-transparent outline-none"
                              style={{
                                border: "1px solid",
                                borderColor: isCustom ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.18)",
                                color: "#fff",
                                minWidth: "80px",
                              }}
                            />
                          </motion.div>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6">
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
                    aria-label={isLastStep ? "build" : "next"}
                    className="mono rounded-full bg-white px-5 py-2 text-[11px] tracking-widest text-black disabled:opacity-30"
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
                className="rounded-[20px] py-20"
                style={{
                  background: "rgba(255,255,255,0.96)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  boxShadow: "0 12px 50px rgba(0,0,0,0.22)",
                }}
              >
                <BuildingScreen inputText={text} comingToLife={comingToLife} statusText={statusText} />
              </motion.div>
            )}

          </AnimatePresence>

          {error && stage !== "building" && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mono text-[10px] tracking-widest opacity-70 mt-6"
            >
              {error}
            </motion.p>
          )}
        </div>

        {stage === "input" && (
          <div className="mx-auto mt-16 w-full max-w-5xl pb-20 sm:mt-24">
            <section className="liquid-glass rounded-[34px] p-5 sm:p-8">
              <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/55">Für kreative Arbeit</p>
              <h2 className="mt-3 max-w-2xl font-brand text-[30px] font-bold leading-[1.06] tracking-[-0.02em] text-white sm:text-[48px]">
                Eine Seite, die als Prompt beginnt und zur gemeinsamen Projektfläche wird.
              </h2>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { href: "/product", label: "Produkt", tag: "Briefing, Rechte, Deliverables." },
                  { href: "/event", label: "Event", tag: "Tempo, Volumen, schnelle Auslieferung." },
                  { href: "/wedding", label: "Hochzeit", tag: "Ein Tag, viele Beteiligte." },
                  { href: "/corporate", label: "Corporate", tag: "Standorte, Termine, Freigaben." },
                  { href: "/fashion", label: "Fashion", tag: "Crew, Styling, Looks." },
                ].map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="liquid-glass rounded-[24px] p-4 transition-transform hover:-translate-y-1"
                  >
                    <span className="block text-sm font-medium text-white">{c.label}</span>
                    <span className="mt-2 block text-sm leading-relaxed text-white/55">{c.tag}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="liquid-glass rounded-[34px] p-5 sm:p-8">
                <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/50">So entsteht ein Projekt</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["01", "Idee rein", "Ein grober Gedanke wird zu klaren Fragen."],
                    ["02", "Bausteine", "MAGYC wählt sinnvolle Abschnitte statt leerer Vorlagen."],
                    ["03", "Zusammen", "Übernehmen, abstimmen, freigeben, hochladen, entscheiden."],
                  ].map(([number, title, body]) => (
                    <div key={number} className="rounded-[24px] border border-white/12 bg-white/[0.035] p-4">
                      <div className="mono text-[11px] tracking-widest text-white/40">{number}</div>
                      <div className="mt-3 text-base font-medium text-white">{title}</div>
                      <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="liquid-glass-strong rounded-[34px] p-5 sm:p-8">
                <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/50">Wofür</p>
                <h3 className="mt-3 font-brand text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-[36px]">
                  Weniger Distanz zwischen Idee und gemeinsamer Realität.
                </h3>
                <p className="mt-5 text-sm leading-relaxed text-white/62">
                  Für ein Shooting, eine Kampagne, einen Event oder jedes frühe Projekt, das einen Ort braucht, um konkret zu werden.
                </p>
                <button
                  type="button"
                  onClick={focusPrompt}
                  className="mt-6 rounded bg-white px-5 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.03] active:scale-[0.97]"
                >
                  Oben starten
                </button>
              </div>
            </section>

            <section id="work" className="mt-5 liquid-glass rounded-[34px] p-5 sm:p-8 scroll-mt-24">
              <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
                <div>
                  <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/50">Für Fotografen</p>
                  <h3 className="mt-3 font-brand text-[28px] font-bold leading-[1.08] tracking-[-0.02em] text-white sm:text-[42px]">
                    Nicht noch eine Galerie. Ein Arbeitsraum, der davor aufraeumt.
                  </h3>
                  <p className="mt-5 text-sm leading-relaxed text-white/62">
                    Moodboard, Shotlist, Rollen, Deliverables und Freigaben entstehen aus dem Briefing. So bleibt mehr Energie fuer Licht, Motiv und Timing.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {HOME_WORK_IMAGES.map((img, i) => (
                    <figure
                      key={img.src}
                      className={`relative overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.04] ${i === 1 ? "translate-y-6" : ""}`}
                    >
                      <Image
                        src={img.src}
                        alt={img.alt}
                        width={520}
                        height={640}
                        sizes="(max-width: 1024px) 45vw, 260px"
                        className="aspect-[4/5] h-full w-full object-cover opacity-82"
                      />
                      <figcaption className="mono absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[9px] uppercase tracking-widest text-white/85 backdrop-blur-sm">
                        {img.label}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>

            <div className="mt-8 overflow-hidden rounded-[34px]">
              <SiteFooter />
            </div>
          </div>
        )}
      </div>

    </main>
  );
}

/**
 * Building screen — references the user's own words while the AI works.
 * Extracts key words from the input and cycles them with a fade animation
 * so the loading state feels specific to this particular space.
 */
