"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { postState } from "@/lib/state";
import type { ModuleStateEntry, QAWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";

/**
 * Fragen und Antworten — questions get answered.
 *
 * Each entry is a `voice` action with role: "question" | "answer" and
 * an optional parentId for answers. We render a top-level list of
 * questions; each question expands its answers underneath.
 *
 * Different from Discussion: Q&A is two-tier (question → answers),
 * never a chat thread.
 */
export function QaRenderer({
  module: m,
  index,
  state,
}: {
  module: QAWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();

  const voices = state
    .filter((e) => e.kind === "voice")
    .sort((a, b) => a.createdAt - b.createdAt);

  const questions = voices.filter((e) => e.data.role === "question");
  const answersOf = (qid: string) =>
    voices.filter((e) => e.data.role === "answer" && e.data.parentId === qid);

  const [pendingQ, setPendingQ] = useState("");
  const [askOpen, setAskOpen] = useState(false);

  async function ask() {
    const v = pendingQ.trim();
    setPendingQ("");
    setAskOpen(false);
    if (!v) return;
    await postState(ctx.spaceId, index, "voice", {
      id: newId("q"),
      role: "question",
      text: v,
    });
    ctx.refresh();
  }

  async function answer(qid: string, text: string) {
    const v = text.trim();
    if (!v) return;
    await postState(ctx.spaceId, index, "voice", {
      id: newId("a"),
      role: "answer",
      parentId: qid,
      text: v,
    });
    ctx.refresh();
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {questions.length === 0 && (
          <p className="mono text-[11px] opacity-50 mb-3" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? "?"}
          </p>
        )}

        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {questions.map((q) => (
              <motion.li
                key={q.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
              >
                <QuestionBlock
                  q={q}
                  answers={answersOf(typeof q.data.id === "string" ? q.data.id : q.id)}
                  onAnswer={(text) =>
                    answer(typeof q.data.id === "string" ? q.data.id : q.id, text)
                  }
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="mt-3">
          {askOpen ? (
            <textarea
              autoFocus
              value={pendingQ}
              onChange={(e) => setPendingQ(e.target.value)}
              onBlur={ask}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(); }
                else if (e.key === "Escape") { setPendingQ(""); setAskOpen(false); }
              }}
              rows={2}
              maxLength={600}
              placeholder="?"
              className="w-full text-[13px] leading-relaxed bg-transparent outline-none resize-none p-2 rounded-md"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              aria-label="ask"
              className="mono text-[10px] tracking-widest px-3 py-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              ?
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function QuestionBlock({
  q,
  answers,
  onAnswer,
}: {
  q: ModuleStateEntry;
  answers: ModuleStateEntry[];
  onAnswer: (text: string) => Promise<void> | void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [pending, setPending] = useState("");

  async function submit() {
    const v = pending;
    setPending("");
    setReplyOpen(false);
    await onAnswer(v);
  }

  return (
    <div className="rounded-md p-3" style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)" }}>
      <div className="flex items-start gap-2.5">
        <ActorDot
          color={typeof q.data.color === "string" ? (q.data.color as string) : undefined}
          displayName={q.actor.displayName}
          size={16}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] leading-snug" style={{ color: "var(--v-fg)" }}>
            {String(q.data.text ?? "")}
          </div>
          <div className="mono text-[9px] tracking-widest mt-1 opacity-60" style={{ color: "var(--v-muted)" }}>
            {q.actor.displayName || "anon"}
          </div>
        </div>
      </div>

      {answers.length > 0 && (
        <ul className="mt-2.5 pl-7 space-y-2">
          {answers.map((a) => (
            <li key={a.id} className="flex items-start gap-2.5">
              <ActorDot
                color={typeof a.data.color === "string" ? (a.data.color as string) : undefined}
                displayName={a.actor.displayName}
                size={14}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] leading-snug" style={{ color: "var(--v-fg)" }}>
                  {String(a.data.text ?? "")}
                </div>
                <div className="mono text-[9px] tracking-widest mt-0.5 opacity-50" style={{ color: "var(--v-muted)" }}>
                  {a.actor.displayName || "anon"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 pl-7">
        {replyOpen ? (
          <textarea
            autoFocus
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
              else if (e.key === "Escape") { setPending(""); setReplyOpen(false); }
            }}
            rows={2}
            maxLength={600}
            placeholder="…"
            className="w-full text-[12.5px] leading-relaxed bg-transparent outline-none resize-none p-2 rounded-md"
            style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setReplyOpen(true)}
            className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
            style={{ color: "var(--v-fg)" }}
          >
            ↵
          </button>
        )}
      </div>
    </div>
  );
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
