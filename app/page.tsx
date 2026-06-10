"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { getAnonToken, rememberSpaceOwnerToken } from "@/lib/anonId";
import { stagePage, clarifyItem } from "@/lib/anim";

type Stage = "input" | "clarify" | "building";

interface ClarifyQuestion {
  id: string;
  kind?: "general" | "data";
  text: string;
  options: { value: string }[];
}

interface Answer {
  questionId: string;
  questionText: string;
  choice: string;
}

/** Slide variants for the per-question transition. */
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
  const [language, setLanguage] = useState("en");
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customDraft, setCustomDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setError(String(json.error || res.status));
        return;
      }
      setQuestions(json.questions || []);
      setLanguage(json.language || "en");
      setQIndex(0);
      setDirection(1);
      setAnswers({});
      setCustomDraft("");
      setStage("clarify");
    } catch {
      setError("✕");
    } finally {
      setBusy(false);
    }
  }

  function pickAnswer(qid: string, qtext: string, value: string) {
    setAnswers((a) => ({ ...a, [qid]: value }));
    setCustomDraft("");
    // Auto-advance to the next question after a brief pause so the
    // user can see their selection highlighted before it slides away.
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      goForward();
    }, 500);
  }

  function goForward() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (qIndex < questions.length - 1) {
      setDirection(1);
      setQIndex((i) => i + 1);
      setCustomDraft("");
    } else {
      goBuild();
    }
  }

  function goBack() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (qIndex > 0) {
      setDirection(-1);
      setQIndex((i) => i - 1);
      setCustomDraft("");
    } else {
      setStage("input");
      setAnswers({});
    }
  }

  async function goBuild() {
    if (busy) return;
    setBusy(true);
    setStage("building");
    setError("");
    const payloadAnswers: Answer[] = questions
      .filter((q) => !!answers[q.id])
      .map((q) => ({ questionId: q.id, questionText: q.text, choice: answers[q.id] }));
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text.trim(), answers: payloadAnswers, anonToken: getAnonToken() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Prefer the detail (the real cause) over the generic code.
        setError(String(json.detail || json.error || res.status));
        setStage("clarify");
        setBusy(false);
        return;
      }
      if (json.anonOwnerToken) rememberSpaceOwnerToken(json.id, json.anonOwnerToken);
      router.push(`/s/${json.id}`);
    } catch {
      setError("✕");
      setStage("clarify");
      setBusy(false);
    }
  }

  const currentQ = questions[qIndex] ?? null;
  const progress = questions.length > 0 ? (qIndex) / questions.length : 0;
  const isLastQ = qIndex === questions.length - 1;
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const isCustom = currentAnswer != null && currentQ != null &&
    !currentQ.options.some((o) => o.value === currentAnswer);

  return (
    <main className="min-h-screen bg-white text-black flex flex-col">
      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" initial={false}>

            {stage === "input" && (
              <motion.div key="input" variants={stagePage} initial="hidden" animate="show" exit="exit">
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  maxLength={1200}
                  placeholder="…"
                  className="w-full text-[20px] sm:text-[24px] leading-relaxed p-4 bg-transparent border-0 outline-none resize-none placeholder:text-black/30"
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); goClarify(); }
                  }}
                />
                <div className="mt-4 flex items-center justify-between gap-4">
                  <span className="mono text-[10px] tracking-widest opacity-40 tabular-nums">
                    {text.length > 0 ? `${text.length}/1200` : ""}
                  </span>
                  <motion.button
                    onClick={goClarify}
                    disabled={busy || text.trim().length < 3}
                    aria-label="continue"
                    className="mono text-[11px] tracking-widest px-4 py-2 rounded-full bg-black text-white disabled:opacity-30"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    {busy ? "…" : "→"}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {stage === "clarify" && currentQ && (
              <motion.div key="clarify" variants={stagePage} initial="hidden" animate="show" exit="exit">
                {/* Progress bar + step counter */}
                <div className="mb-8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="mono text-[9px] tracking-widest opacity-40 tabular-nums">
                      {qIndex + 1} / {questions.length}
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

                {/* Single question — slides in/out */}
                <div className="overflow-hidden" style={{ minHeight: 220 }}>
                  <AnimatePresence custom={direction} mode="wait" initial={false}>
                    <motion.div
                      key={currentQ.id}
                      custom={direction}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="space-y-5"
                    >
                      {/* The user's input as context */}
                      <p className="mono text-[10px] tracking-widest opacity-30 truncate">
                        {text.trim().slice(0, 80)}
                      </p>

                      <h3 className="text-[18px] sm:text-[22px] leading-snug font-medium flex items-baseline gap-2">
                        {currentQ.kind === "data" && (
                          <span aria-hidden className="mono text-[11px] tracking-widest opacity-40">◆</span>
                        )}
                        <span>{currentQ.text}</span>
                      </h3>

                      <div className="flex flex-wrap gap-2">
                        {currentQ.options.map((o) => {
                          const picked = currentAnswer === o.value;
                          return (
                            <motion.button
                              key={o.value}
                              onClick={() => pickAnswer(currentQ.id, currentQ.text, o.value)}
                              className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full"
                              style={{
                                border: "1px solid",
                                borderColor: picked ? "#000" : "rgba(0,0,0,0.12)",
                                background: picked ? "#000" : "transparent",
                                color: picked ? "#fff" : "#000",
                              }}
                              whileHover={{ scale: 1.03 }}
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
                            if (v.trim()) setAnswers((a) => ({ ...a, [currentQ.id]: v.trim() }));
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
                      </div>
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
                    aria-label={isLastQ ? "build" : "next"}
                    className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white disabled:opacity-30"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    {busy ? "…" : isLastQ ? "→" : "→"}
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
                className="py-20"
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

      <footer className="px-6 py-3 mono text-[9px] tracking-widest text-center opacity-30">
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
