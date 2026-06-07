"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAnonToken, rememberSpaceOwnerToken } from "@/lib/anonId";

type Stage = "input" | "clarify" | "building";

interface ClarifyQuestion {
  id: string;
  text: string;
  options: { value: string }[];
}

interface Answer {
  questionId: string;
  questionText: string;
  choice: string;
}

/**
 * Home — three steps, all on one white page.
 *
 *   1. INPUT     — single textarea, the only place free text lives.
 *   2. CLARIFY   — 2-4 multiple-choice questions surface; each has
 *                  3 options + an "anders…" custom-text fallback.
 *   3. BUILDING  — busy state while the classifier runs, then
 *                  redirect to /s/<id>.
 */
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
        setError(json?.error || "failed");
        return;
      }
      setQuestions(json.questions || []);
      setStage("clarify");
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  }

  function setAnswer(qid: string, qtext: string, choice: string) {
    setAnswers((a) => ({ ...a, [qid]: choice }));
  }

  const allAnswered = questions.length > 0 && questions.every((q) => !!answers[q.id]);

  async function goBuild() {
    if (busy || !allAnswered) return;
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
        setError(json?.error || "failed");
        setStage("clarify");
        setBusy(false);
        return;
      }
      if (json.anonOwnerToken) {
        rememberSpaceOwnerToken(json.id, json.anonOwnerToken);
      }
      router.push(`/s/${json.id}`);
    } catch {
      setError("failed");
      setStage("clarify");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black flex flex-col">
      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {stage === "input" && (
            <>
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
                <span className="mono text-[10px] tracking-widest opacity-40">
                  {text.length > 0 ? `${text.length}/1200` : ""}
                </span>
                <button
                  onClick={goClarify}
                  disabled={busy || text.trim().length < 3}
                  className="mono text-[11px] tracking-widest px-4 py-2 rounded-full bg-black text-white disabled:opacity-30 transition-opacity"
                >
                  {busy ? "…" : "→"}
                </button>
              </div>
            </>
          )}

          {stage === "clarify" && (
            <div className="space-y-8 animate-fadeIn">
              <p className="text-[15px] leading-relaxed text-black/70 italic">
                „{text.trim()}"
              </p>
              <hr className="border-black/10" />
              {questions.map((q) => (
                <div key={q.id} className="space-y-2.5">
                  <div className="mono text-[10px] tracking-widest opacity-50">
                    {q.id.toUpperCase()}
                  </div>
                  <h3 className="text-[17px] sm:text-[19px] leading-snug">{q.text}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((o) => {
                      const picked = answers[q.id] === o.value;
                      return (
                        <button
                          key={o.value}
                          onClick={() => setAnswer(q.id, q.text, o.value)}
                          className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full transition-colors"
                          style={{
                            border: "1px solid",
                            borderColor: picked ? "#000" : "#0001",
                            background: picked ? "#000" : "transparent",
                            color: picked ? "#fff" : "#000",
                          }}
                        >
                          {o.value}
                        </button>
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
                            if (v.trim().length > 0) {
                              setAnswer(q.id, q.text, v.trim());
                            }
                          }}
                          placeholder="anders…"
                          maxLength={120}
                          className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full bg-transparent outline-none"
                          style={{
                            border: "1px solid",
                            borderColor: customActive ? "#000" : "#0001",
                            color: "#000",
                            minWidth: "120px",
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => { setStage("input"); setAnswers({}); setCustomDrafts({}); }}
                  className="mono text-[11px] tracking-widest opacity-50 hover:opacity-100"
                >
                  ← zurück
                </button>
                <button
                  onClick={goBuild}
                  disabled={busy || !allAnswered}
                  className="mono text-[11px] tracking-widest px-5 py-2 rounded-full bg-black text-white disabled:opacity-30 transition-opacity"
                >
                  {busy ? "…" : "weiter →"}
                </button>
              </div>
            </div>
          )}

          {stage === "building" && (
            <div className="text-center py-20 animate-fadeIn">
              <div className="mono text-[10px] tracking-widest opacity-60 mb-4">
                BAUE…
              </div>
              <div className="text-[16px] opacity-80 max-w-md mx-auto leading-relaxed">
                Aus deinem Gedanken und deinen Antworten entsteht gleich ein
                Raum, den du teilen kannst.
              </div>
            </div>
          )}

          {error && stage !== "building" && (
            <p className="mono text-[10px] tracking-widest opacity-60 mt-6">{error}</p>
          )}
        </div>
      </section>
      <footer className="px-6 py-3 mono text-[9px] tracking-widest text-center flex items-center justify-center gap-4 opacity-30">
        <span>CREATOR</span>
        <span>·</span>
        <a href="/showroom" className="hover:opacity-100">SHOWROOM</a>
      </footer>
    </main>
  );
}
