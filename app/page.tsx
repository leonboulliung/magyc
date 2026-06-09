"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { getAnonToken, rememberSpaceOwnerToken } from "@/lib/anonId";
import {
  stagePage,
  clarifyContainer,
  clarifyItem,
} from "@/lib/anim";

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

export default function HomePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      setStage("clarify");
    } catch {
      setError("✕");
    } finally {
      setBusy(false);
    }
  }

  function setAnswer(qid: string, qtext: string, choice: string) {
    setAnswers((a) => ({ ...a, [qid]: choice }));
  }

  const answeredCount = questions.filter((q) => !!answers[q.id]).length;

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
        body: JSON.stringify({
          input: text.trim(),
          answers: payloadAnswers,
          anonToken: getAnonToken(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = json.error || json.detail || res.status;
        setError(String(detail));
        setStage("clarify");
        setBusy(false);
        return;
      }
      if (json.anonOwnerToken) {
        rememberSpaceOwnerToken(json.id, json.anonOwnerToken);
      }
      router.push(`/s/${json.id}`);
    } catch {
      setError("✕");
      setStage("clarify");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black flex flex-col">
      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {/* AnimatePresence mode="wait" ensures the exiting stage
              fully leaves before the entering one appears. */}
          <AnimatePresence mode="wait" initial={false}>

            {stage === "input" && (
              <motion.div
                key="input"
                variants={stagePage}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  maxLength={1200}
                  placeholder="…"
                  className="w-full text-[20px] sm:text-[24px] leading-relaxed p-4 bg-transparent border-0 outline-none resize-none placeholder:text-black/30"
                  disabled={busy}
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

            {stage === "clarify" && (
              <motion.div
                key="clarify"
                variants={stagePage}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <motion.p
                  className="text-[15px] leading-relaxed text-black/70 italic mb-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                >
                  „{text.trim()}"
                </motion.p>
                <hr className="border-black/10 mb-6" />

                <motion.div
                  className="space-y-8"
                  variants={clarifyContainer}
                  initial="hidden"
                  animate="show"
                >
                  {questions.map((q) => (
                    <motion.div
                      key={q.id}
                      variants={clarifyItem}
                      className="space-y-2.5"
                      aria-label={q.kind === "data" ? "data question" : "framing question"}
                    >
                      <h3 className="text-[17px] sm:text-[19px] leading-snug flex items-baseline gap-2">
                        {q.kind === "data" && (
                          <span
                            aria-hidden
                            className="mono text-[10px] tracking-widest opacity-30 translate-y-[-1px]"
                            title="data"
                          >
                            ◆
                          </span>
                        )}
                        <span>{q.text}</span>
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {q.options.map((o) => {
                          const picked = answers[q.id] === o.value;
                          return (
                            <motion.button
                              key={o.value}
                              onClick={() => setAnswer(q.id, q.text, o.value)}
                              className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full"
                              style={{
                                border: "1px solid",
                                borderColor: picked ? "#000" : "#0001",
                                background: picked ? "#000" : "transparent",
                                color: picked ? "#fff" : "#000",
                              }}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            >
                              {o.value}
                            </motion.button>
                          );
                        })}
                        {(() => {
                          const customActive = answers[q.id] != null &&
                            !q.options.some((o) => o.value === answers[q.id]);
                          return (
                            <input
                              type="text"
                              value={customDrafts[q.id] ?? (customActive ? answers[q.id] : "")}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCustomDrafts((c) => ({ ...c, [q.id]: v }));
                                if (v.trim().length > 0) setAnswer(q.id, q.text, v.trim());
                              }}
                              placeholder="…"
                              maxLength={120}
                              className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full bg-transparent outline-none"
                              style={{
                                border: "1px solid",
                                borderColor: customActive ? "#000" : "#0001",
                                color: "#000",
                                minWidth: "100px",
                              }}
                            />
                          );
                        })()}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                <div className="flex items-center justify-between pt-8">
                  <motion.button
                    onClick={() => { setStage("input"); setAnswers({}); setCustomDrafts({}); }}
                    aria-label="back"
                    className="mono text-[12px] tracking-widest opacity-50 hover:opacity-100"
                    whileHover={{ x: -3 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    ←
                  </motion.button>
                  <div className="flex items-center gap-3">
                    {answeredCount > 0 && answeredCount < questions.length && (
                      <motion.span
                        className="mono text-[9px] tracking-widest opacity-30 tabular-nums"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.3 }}
                      >
                        {answeredCount}/{questions.length}
                      </motion.span>
                    )}
                    <motion.button
                      onClick={goBuild}
                      disabled={busy}
                      aria-label="continue"
                      className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white disabled:opacity-30"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      {busy ? "…" : "→"}
                    </motion.button>
                  </div>
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
                className="text-center py-20"
              >
                <BuildingPulse />
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

/** Animated building state — three dots pulsing with a stagger. */
function BuildingPulse() {
  return (
    <div className="flex items-center justify-center gap-2" aria-label="building">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block rounded-full bg-black"
          style={{ width: 6, height: 6 }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
