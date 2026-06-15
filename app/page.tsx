"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { getAnonToken, rememberSpaceOwnerToken } from "@/lib/anonId";
import { stagePage, chipGrid, clarifyItem } from "@/lib/anim";
import type { ClarifyStep, Module } from "@/lib/types";
import { ClarifyModuleStep } from "@/components/clarify/ClarifyModuleStep";
import { DotField, type DotFieldHandle } from "@/components/DotField";
import { EnterKey } from "@/components/EnterKey";
import { PROJECT_MODES, projectModeById, type ProjectModeId } from "@/lib/projectModes";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { AREAS } from "@/lib/site";
import { EmergentBackdrop } from "@/components/site/EmergentBackdrop";

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

/**
 * Read a human error string out of an API (or Vercel platform) error
 * body. Vercel's own errors (504 timeout, function crash) return
 * `error` as an OBJECT { code, message } — String()'ing that yields the
 * useless "[object Object]". This unwraps any shape into readable text.
 */
function apiError(json: unknown, status: number): string {
  const j = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const pick = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.message === "string") return o.message;
      if (typeof o.code === "string") return o.code;
    }
    return null;
  };
  return pick(j.detail) || pick(j.error) || (status === 504 ? "timeout" : `error ${status}`);
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function formatFlowError(message: string, extra?: { retryInSeconds?: unknown }): string {
  if (message === "timeout") return "This took too long. Please try again.";
  if (message === "rate_limited" && typeof extra?.retryInSeconds === "number") {
    return `Please wait ${extra.retryInSeconds}s and try again.`;
  }
  if (message === "input_too_short") return "Please add a little more detail.";
  if (message === "ai_not_configured") return "The AI backend is not configured yet.";
  if (message === "openai_rate_limited") return "The AI is busy right now. Please try again.";
  if (message === "clarify_failed" || message === "classify_failed") return "The request did not complete. Please try again.";
  return message;
}

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
        <EmergentBackdrop />
      ) : (
        <div className="fixed inset-0 z-0 bg-black">
          <DotField ref={dotFieldRef} />
          <div className="absolute inset-0 bg-black/70" />
        </div>
      )}

      {stage === "input" && <SiteNav />}

      {stage === "input" && (
        <div
          className={`fixed left-0 right-0 z-20 w-full px-4 transition-all duration-1000 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
          style={{ top: "112px" }}
        >
          <div className="mx-auto grid w-fit place-items-center rounded-[28px] bg-white px-5 py-3 shadow-[0_18px_70px_rgba(255,255,255,0.12)] sm:px-7 sm:py-4">
            <Image
              src="/magyc-marble-2048x2048.png"
              alt="MAGYC"
              width={1130}
              height={312}
              priority
              className="h-[54px] w-auto select-none sm:h-[74px] lg:h-[92px]"
            />
          </div>
        </div>
      )}

      <div
        className={
          stage === "input"
            ? "relative z-30 min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-[250px] sm:px-8 sm:pt-[310px]"
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
                <div
                  id="start"
                  className="liquid-glass-strong w-full scroll-mt-20 rounded-[34px] p-5 transition-shadow duration-300 sm:rounded-[42px] sm:p-7"
                  style={{
                    boxShadow: promptNudge
                      ? "0 0 0 1px rgba(255,255,255,0.62), 0 18px 60px rgba(0,0,0,0.22), 0 0 38px rgba(255,255,255,0.13), inset 0 1px 1px rgba(255,255,255,0.15)"
                      : "0 18px 60px rgba(0,0,0,0.22), inset 0 1px 1px rgba(255,255,255,0.15)",
                  }}
                >
                  <div className="mb-5 flex flex-col gap-3">
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
                  </div>

                  <textarea
                    ref={inputRef}
                    autoFocus
                    value={text}
                    onChange={(e) => {
                      setPromptNudge(false);
                      setText(e.target.value);
                    }}
                    rows={2}
                    maxLength={1200}
                    placeholder={selectedMode?.placeholder ?? "Describe a rough idea, project, or plan."}
                    className="w-full resize-none border-0 bg-transparent text-[20px] leading-relaxed text-white outline-none placeholder:text-white/32 sm:text-[24px]"
                    disabled={busy}
                    onKeyDown={(e) => {
                      // Enter submits; Shift+Enter (or ⌘/Ctrl+Enter) = newline.
                      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        submitInput();
                      }
                    }}
                  />
                  <div className="mt-3 flex justify-end">
                    <span className="mono text-[10px] tracking-widest opacity-40 tabular-nums">
                      {text.length > 0 ? `${text.length}/1200` : ""}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {text.trim().length === 0 ? (
                      promptExamples.map((example) => (
                        <button
                          key={`${example.mode ?? "free"}:${example.prompt}`}
                          type="button"
                          onClick={() => applyExample(example.prompt, example.mode)}
                          disabled={busy}
                          className="text-left text-[12px] sm:text-[13px] leading-snug px-3 py-2 rounded transition-all disabled:opacity-30 hover:bg-white/10"
                          style={{
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(255,255,255,0.035)",
                            color: "rgba(255,255,255,0.72)",
                          }}
                        >
                          {example.prompt}
                        </button>
                      ))
                    ) : (
                      assistChips.map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => addPromptHint(chip.text)}
                          disabled={busy}
                          className="mono text-[10px] sm:text-[11px] tracking-widest px-3 py-2 rounded transition-opacity disabled:opacity-30"
                          style={{
                            border: "1px dashed rgba(255,255,255,0.22)",
                            background: "transparent",
                            color: "rgba(255,255,255,0.64)",
                          }}
                        >
                          {chip.label}
                        </button>
                      ))
                    )}
                  </div>
                  {!busy && (
                    <p className="mt-4 text-[13px] opacity-55 leading-relaxed">
                      Start with a rough idea, a plan, or a prompt.
                    </p>
                  )}
                </div>

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
                className="rounded-[20px] p-5 sm:p-9"
                style={{
                  background: "rgba(255,255,255,0.96)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  boxShadow: "0 12px 50px rgba(0,0,0,0.22)",
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
                    style={{ height: 2, background: "rgba(0,0,0,0.07)" }}
                  >
                    <motion.div
                      className="h-full rounded-full bg-black"
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
                            className="w-full text-[16px] leading-relaxed p-3 rounded-[20px] bg-transparent outline-none resize-none placeholder:text-black/25"
                            style={{ border: "1px solid rgba(0,0,0,0.15)" }}
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
                                    borderColor: picked ? "#000" : "rgba(0,0,0,0.12)",
                                    background: picked ? "#000" : "transparent",
                                    color: picked ? "#fff" : "#000",
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
                                borderColor: isCustom ? "#000" : "rgba(0,0,0,0.08)",
                                color: "#000",
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
                    className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white disabled:opacity-30"
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
              <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/55">For creative work</p>
              <h2 className="mt-3 max-w-2xl font-heading text-[32px] italic leading-[1.02] tracking-[-0.01em] text-white sm:text-[52px]">
                A page that starts as a prompt and becomes a shared project surface.
              </h2>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {AREAS.map((area) => (
                  <Link
                    key={area.slug}
                    href={`/for/${area.slug}`}
                    className="liquid-glass rounded-[24px] p-4 transition-transform hover:-translate-y-1"
                  >
                    <span className="block text-sm font-medium text-white">{area.label}</span>
                    <span className="mt-2 block text-sm leading-relaxed text-white/55">{area.tagline}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="liquid-glass rounded-[34px] p-5 sm:p-8">
                <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/50">Example landscape</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["01", "Intake", "A rough thought becomes structured questions."],
                    ["02", "Elements", "MAGYC chooses useful sections instead of blank templates."],
                    ["03", "Collaboration", "People can claim, vote, approve, upload, and decide."],
                  ].map(([number, title, body]) => (
                    <div key={number} className="rounded-[24px] border border-white/12 bg-white/[0.035] p-4">
                      <div className="mono text-[11px] tracking-widest text-white/40">{number}</div>
                      <div className="mt-3 text-base font-medium text-white">{title}</div>
                      <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
                    </div>
                  ))}
                </div>
                <Link href="/showcase" className="mono mt-6 inline-block text-[12px] uppercase tracking-widest text-white/60 hover:text-white">
                  Open gallery
                </Link>
              </div>

              <div className="liquid-glass-strong rounded-[34px] p-5 sm:p-8">
                <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/50">First users</p>
                <h3 className="mt-3 font-heading text-[30px] italic leading-tight text-white sm:text-[40px]">
                  Built to reduce the distance between idea and shared reality.
                </h3>
                <p className="mt-5 text-sm leading-relaxed text-white/62">
                  Use it for a shoot, campaign, workshop, event, or any early project that needs a place to become concrete.
                </p>
                <button
                  type="button"
                  onClick={focusPrompt}
                  className="mt-6 rounded bg-white px-5 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.03] active:scale-[0.97]"
                >
                  Start above
                </button>
              </div>
            </section>

            <div className="mt-8 overflow-hidden rounded-[34px]">
              <SiteFooter />
            </div>
          </div>
        )}
      </div>

      {stage === "input" && (
        <div
          className={`fixed bottom-8 left-0 right-0 z-40 hidden items-end justify-between px-10 transition-all delay-300 duration-1000 md:flex ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
          }`}
        >
          <p className="max-w-[220px] text-sm font-light leading-relaxed text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.8)]">
            MAGYC understands context, structure, and momentum like a creative director would.
          </p>
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-3">
            <button
              type="button"
              onPointerDown={() => {
                if (text.trim().length < 3 && !busy) nudgePrompt();
              }}
              onClick={promptOrSubmit}
              disabled={busy}
              className="group relative overflow-hidden rounded bg-white px-6 py-3 text-sm font-medium text-black shadow-[0_0_0_0_rgba(255,255,255,0)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_24px_4px_rgba(255,255,255,0.25)] active:scale-[0.97] disabled:opacity-40"
            >
              <span className="relative z-10">Start generating</span>
              <span className="absolute inset-0 bg-gradient-to-b from-white to-white/85 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </button>
            <Link
              href="/showcase"
              className="liquid-glass group rounded px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.03] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_20px_2px_rgba(255,255,255,0.07)] active:scale-[0.97]"
            >
              See examples
            </Link>
          </div>
          <p className="max-w-[220px] text-right text-sm font-light leading-relaxed text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.8)]">
            Describe what you see in your head. Get a page that actually helps it become real.
          </p>
        </div>
      )}
    </main>
  );
}

/**
 * Building screen — references the user's own words while the AI works.
 * Extracts key words from the input and cycles them with a fade animation
 * so the loading state feels specific to this particular space.
 */
function BuildingScreen({
  inputText,
  comingToLife,
  statusText,
}: {
  inputText: string;
  comingToLife?: string;
  statusText?: string;
}) {
  // Fallback when the AI line is unavailable: cycle the input's own key
  // words so the wait still feels specific to this space.
  const words = inputText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 12);
  const displayWords = words.length > 0 ? words : ["…"];
  const [idx, setIdx] = useState(0);
  const [showSlowHint, setShowSlowHint] = useState(false);

  const line = (comingToLife || "").trim();

  useEffect(() => {
    if (line || displayWords.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % displayWords.length), 700);
    return () => clearInterval(id);
  }, [line, displayWords.length]);

  useEffect(() => {
    setShowSlowHint(false);
    const id = window.setTimeout(() => setShowSlowHint(true), 12000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Three pulsing dots */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block rounded-full bg-black"
            style={{ width: 5, height: 5 }}
            animate={{ opacity: [0.15, 1, 0.15], scale: [0.7, 1.15, 0.7] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
          />
        ))}
      </div>

      {line ? (
        // The AI's "bringing your idea to life" line — specific to this
        // space, in the user's language. Reads as the build narrating
        // itself rather than a generic spinner.
        <motion.p
          className="text-[17px] sm:text-[19px] leading-relaxed text-center max-w-md px-6"
          style={{ color: "rgba(0,0,0,0.78)" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {line}
        </motion.p>
      ) : (
        <div style={{ height: 28 }} className="flex items-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={idx}
              className="mono text-[12px] tracking-widest text-center"
              style={{ color: "rgba(0,0,0,0.28)" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.2, ease: "easeIn" } }}
            >
              {displayWords[idx]}
            </motion.span>
          </AnimatePresence>
        </div>
      )}

      {statusText && (
        <p className="mono text-[10px] tracking-widest opacity-45 text-center">
          {statusText}
        </p>
      )}

      {showSlowHint && (
        <p className="text-[13px] opacity-45 text-center px-6 leading-relaxed">
          Still working. Your space can take a little longer when the prompt is complex.
        </p>
      )}
    </div>
  );
}
