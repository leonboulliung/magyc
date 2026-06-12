"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { getAnonToken, rememberSpaceOwnerToken } from "@/lib/anonId";
import { stagePage, chipGrid, clarifyItem } from "@/lib/anim";
import type { ClarifyStep, Module } from "@/lib/types";
import { ClarifyModuleStep } from "@/components/clarify/ClarifyModuleStep";
import { DotField, type DotFieldHandle } from "@/components/DotField";
import { EnterKey } from "@/components/EnterKey";

type Stage = "input" | "clarify" | "building";

interface Answer {
  questionId: string;
  questionText: string;
  choice: string;
}

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
  const [text, setText] = useState("");
  const [, setLanguage] = useState("en");
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
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotFieldRef = useRef<DotFieldHandle>(null);
  const enterKeyRef = useRef<HTMLButtonElement>(null);

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

  // Clean up auto-advance timer on unmount
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  async function goClarify() {
    if (busy) return;
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/spaces/clarify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: trimmed, anonToken: getAnonToken() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiError(json, res.status));
        return;
      }
      setSteps(Array.isArray(json.steps) ? json.steps : []);
      setLanguage(json.language || "en");
      setAnswers({});
      setConfigured({});
      setStepIndex(0);
      setDirection(1);
      setCustomDraft("");
      setStage("clarify");
    } catch {
      setError("✕");
    } finally {
      setBusy(false);
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
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text.trim(), answers: payloadAnswers, configuredModules, anonToken: getAnonToken() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiError(json, res.status));
        setStage("clarify");
        setBusy(false);
        dotFieldRef.current?.setThinking(false);
        return;
      }
      if (json.anonOwnerToken) rememberSpaceOwnerToken(json.id, json.anonOwnerToken);
      // Keep pulsing — navigation unmounts the page on success.
      router.push(`/s/${json.id}`);
    } catch {
      setError("✕");
      setStage("clarify");
      setBusy(false);
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
    // fixed inset-0 locks the home to the viewport — no page scroll or
    // rubber-band bounce on mobile. Other routes (the space view) keep
    // their normal scrolling.
    <main
      className="fixed inset-0 text-black flex flex-col overflow-hidden"
      style={{ background: "#fafafa", overscrollBehavior: "none" }}
    >
      {/* Infinite dot field — the signature surface, behind everything. */}
      <div className="fixed inset-0 z-0">
        <DotField ref={dotFieldRef} />
      </div>

      {/* Brand watermark — large, full-bleed, very low opacity. */}
      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          draggable={false}
          className="select-none"
          style={{ width: "min(1200px, 94vw)", maxWidth: "none", opacity: 0.08 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      <section className="relative z-10 flex-1 flex items-center justify-center px-6 py-8 min-h-0">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" initial={false}>

            {stage === "input" && (
              <motion.div
                key="input"
                variants={stagePage}
                initial="hidden"
                animate="show"
                exit="exit"
                className="relative w-full"
              >
                {/* The card is just the input now. Its corner radius
                    matches the Thing-page widgets (6px) so the Enter
                    key's notch cradles this corner cleanly. It reserves
                    bottom-right room (margins) for the key to dock. */}
                <div
                  className="rounded-md p-6 sm:p-8"
                  style={{
                    marginRight: 68,
                    marginBottom: 54,
                    background: "#fff",
                    border: "1px solid rgba(0,0,0,0.06)",
                    boxShadow: "0 12px 50px rgba(0,0,0,0.09)",
                  }}
                >
                  <textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    maxLength={1200}
                    placeholder=""
                    className="w-full text-[20px] sm:text-[24px] leading-relaxed bg-transparent border-0 outline-none resize-none"
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
                    <span className="mono text-[10px] tracking-widest opacity-30 tabular-nums">
                      {text.length > 0 ? `${text.length}/1200` : ""}
                    </span>
                  </div>
                </div>

                {/* Enter key docks into the card's bottom-right corner —
                    its rounded 6px notch cradles the card's 6px corner
                    with a uniform ~8px of air. */}
                <div className="absolute" style={{ right: 0, bottom: 0 }}>
                  <EnterKey
                    ref={enterKeyRef}
                    onPress={submitInput}
                    disabled={busy || text.trim().length < 3}
                    busy={busy}
                  />
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
                className="rounded-3xl p-6 sm:p-9"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 12px 50px rgba(0,0,0,0.09)",
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
                            className="w-full text-[16px] leading-relaxed p-3 rounded-lg bg-transparent outline-none resize-none placeholder:text-black/25"
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
                className="rounded-3xl py-20"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 12px 50px rgba(0,0,0,0.09)",
                }}
              >
                <BuildingScreen inputText={text} />
              </motion.div>
            )}

          </AnimatePresence>

          {error && stage !== "building" && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mono text-[10px] tracking-widest opacity-60 mt-6"
            >
              {error}
            </motion.p>
          )}
        </div>
      </section>

      <footer className="relative z-10 px-6 py-3 mono text-[9px] tracking-widest text-center opacity-30">
        <span>magyc.site</span>
      </footer>
    </main>
  );
}

/**
 * Building screen — references the user's own words while the AI works.
 * Extracts key words from the input and cycles them with a fade animation
 * so the loading state feels specific to this particular space.
 */
function BuildingScreen({ inputText }: { inputText: string }) {
  const words = inputText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 3) // skip short words
    .slice(0, 12);

  const displayWords = words.length > 0 ? words : ["…"];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (displayWords.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % displayWords.length), 700);
    return () => clearInterval(id);
  }, [displayWords.length]);

  return (
    <div className="flex flex-col items-center gap-8">
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

      {/* Cycling word from the user's input */}
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
    </div>
  );
}
