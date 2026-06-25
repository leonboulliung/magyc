"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { getAnonToken, rememberSpaceOwnerToken } from "@/lib/anonId";
import { stagePage, chipGrid, clarifyItem } from "@/lib/anim";
import type { ClarifyStep, Module } from "@/lib/types";
import { ClarifyModuleStep } from "@/components/clarify/ClarifyModuleStep";
import { DotField, type DotFieldHandle } from "@/components/DotField";
import { DEFAULT_CREATE_FAST_PROMPTS, PromptStart } from "@/components/create/PromptStart";
import type { ProjectModeId } from "@/lib/projectModes";
import { MARKETING_STARTER_PRESETS } from "@/lib/studioPresets";
import { SiteNav } from "@/components/site/SiteNav";
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
const DEFAULT_PROJECT_MODE: ProjectModeId = "photo_shoot";

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
  const [, setLanguage] = useState("de");
  const [presetId, setPresetId] = useState("none");
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    const o = originOf(null); // ripple from screen centre (no Enter-key anchor)
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
    setStatusText("Rückfragen werden vorbereitet …");
    try {
      const { res, json } = await fetchJsonWithTimeout("/api/spaces/clarify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: trimmed, projectMode: DEFAULT_PROJECT_MODE, anonToken: getAnonToken() }),
      }, CLARIFY_TIMEOUT_MS);
      if (!res.ok) {
        setError(formatFlowError(apiError(json, res.status), json as { retryInSeconds?: unknown }));
        return;
      }
      const nextSteps = Array.isArray(json.steps) ? json.steps : [];
      if (nextSteps.length === 0) {
        setError("Keine Rückfragen erhalten. Bitte erneut versuchen.");
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
    setStatusText("Arbeitsraum wird erstellt …");
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
    const selectedPreset = MARKETING_STARTER_PRESETS.find((preset) => preset.id === presetId) || null;
    try {
      const { res, json } = await fetchJsonWithTimeout("/api/spaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: text.trim(),
          projectMode: DEFAULT_PROJECT_MODE,
          answers: payloadAnswers,
          configuredModules,
          presetName: selectedPreset?.name,
          presetModules: selectedPreset?.modules,
          presetPromptInjections: selectedPreset?.promptInjections,
          presetAllowContextModules: selectedPreset?.allowContextModules,
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
      className="fixed inset-0 flex flex-col overflow-hidden bg-[#f4f4f1] font-body text-[#17171a]"
      style={{ overscrollBehavior: "none" }}
    >
      {stage === "input" ? (
        <>
          <DotField ref={dotFieldRef} color="0,0,0" className="fixed inset-0 z-[1] opacity-[0.055]" />
          <div
            className="pointer-events-none fixed inset-0 z-[2]"
            style={{ background: "radial-gradient(circle at 50% -10%, rgba(0,0,0,0.055), transparent 44%)" }}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-0 bg-[#f4f4f1]">
          <DotField ref={dotFieldRef} color="0,0,0" className="opacity-[0.05]" />
          <div className="absolute inset-0 bg-[#f4f4f1]/72" />
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
                <PromptStart
                  id="start"
                  inputRef={inputRef}
                  className="scroll-mt-20"
                  value={text}
                  onChange={(v) => { setPromptNudge(false); setText(v); }}
                  onSubmit={submitInput}
                  disabled={busy}
                  autoFocus
                  rows={5}
                  highlight={promptNudge}
                  presets={MARKETING_STARTER_PRESETS}
                  selectedPresetId={presetId}
                  onPresetChange={(id) => { setPresetId(id); focusPrompt(); }}
                  fastPrompts={DEFAULT_CREATE_FAST_PROMPTS}
                  onFastPrompt={addPromptHint}
                />

                {/* Submit lives in the composer itself (gradient send + Enter),
                    matching the Studio prompt field. Status only below. */}
                {statusText && (
                  <div className="mt-3 flex justify-end">
                    <p className="mono text-[10px] tracking-widest opacity-60 text-right text-[#17171a]">
                      {statusText}
                    </p>
                  </div>
                )}
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
                  border: "1px solid rgba(0,0,0,0.12)",
                  boxShadow: "0 18px 70px rgba(0,0,0,0.08)",
                  ["--v-radius" as string]: "28px",
                  ["--v-bg" as string]: "rgba(0,0,0,0.035)",
                  ["--v-fg" as string]: "#17171a",
                  ["--v-muted" as string]: "rgba(23,23,26,0.58)",
                  ["--v-rule" as string]: "rgba(0,0,0,0.14)",
                  ["--v-accent" as string]: "#17171a",
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
                    style={{ height: 2, background: "rgba(0,0,0,0.1)" }}
                  >
                    <motion.div
                      className="h-full rounded-full bg-[#17171a]"
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
                            className="w-full resize-none rounded-[28px] p-4 text-[16px] leading-relaxed outline-none placeholder:text-black/28"
                            style={{ border: "1px solid rgba(0,0,0,0.14)", background: "rgba(0,0,0,0.025)", color: "#17171a" }}
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
                                    borderColor: picked ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.14)",
                                    background: picked ? "#17171a" : "rgba(0,0,0,0.025)",
                                    color: picked ? "#fff" : "rgba(23,23,26,0.72)",
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
                                borderColor: isCustom ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.14)",
                                color: "#17171a",
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
                className="rounded-[20px] bg-white py-20"
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  boxShadow: "0 12px 50px rgba(0,0,0,0.08)",
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
          <div className="pointer-events-none mx-auto flex w-full max-w-6xl justify-between pb-10 pt-16 text-[13px] leading-relaxed text-black/45 sm:pt-24">
            <p className="max-w-[230px]">
              MAGYC ordnet kreative Arbeit, bevor sie schwer wird.
            </p>
            <p className="hidden max-w-[260px] text-right sm:block">
              Beschreibe, was entstehen soll. Der Arbeitsraum beginnt hier.
            </p>
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
