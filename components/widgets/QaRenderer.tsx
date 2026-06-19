"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { newLocalId } from "@/lib/id";
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

  // Append-only log → deletes are `edit` entries carrying { id, deleted }.
  const deleted = new Set<string>();
  for (const e of state) {
    if (e.kind === "edit" && e.data.deleted === true && typeof e.data.id === "string") {
      deleted.add(e.data.id);
    }
  }

  const seededQuestions = (m.questions ?? []).map((question, i) => ({
    key: `seed-${i}`,
    seedIndex: i,
    text: question.text,
    answerHint: question.answerHint,
    seeded: true,
  }));

  const stateQuestions = voices
    .filter((e) => e.data.role === "question")
    .map((e) => ({
      key: typeof e.data.id === "string" ? e.data.id : e.id,
      seedIndex: -1,
      text: String(e.data.text ?? ""),
      seeded: false,
      actor: {
        displayName: e.actor.displayName,
        color: typeof e.data.color === "string" ? (e.data.color as string) : undefined,
      },
    }))
    .filter((question) => question.text && !deleted.has(question.key));

  const questions = [...seededQuestions, ...stateQuestions];
  const answersOf = (qid: string) =>
    voices.filter(
      (e) =>
        e.data.role === "answer" &&
        e.data.parentId === qid &&
        !deleted.has(typeof e.data.id === "string" ? e.data.id : e.id),
    );

  const [pendingQ, setPendingQ] = useState("");
  const [askOpen, setAskOpen] = useState(false);

  async function ask() {
    const v = pendingQ.trim();
    setPendingQ("");
    setAskOpen(false);
    if (!v) return;
    await ctx.act(index, "voice", {
      id: newLocalId("q"),
      role: "question",
      text: v,
    });
  }

  async function answer(qid: string, text: string) {
    const v = text.trim();
    if (!v) return;
    await ctx.act(index, "voice", {
      id: newLocalId("a"),
      role: "answer",
      parentId: qid,
      text: v,
    });
  }

  // Delete a state-added question/answer (append-only → edit{deleted}).
  async function deleteVoice(id: string) {
    await ctx.act(index, "edit", { id, deleted: true });
  }
  // Remove a seeded (config) question — owner only, via saveModule.
  function removeSeeded(seedIndex: number) {
    const questionsCfg = (m.questions ?? []).filter((_, i) => i !== seedIndex);
    ctx.saveModule(index, { ...m, questions: questionsCfg });
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {questions.length === 0 && (
          <p className="mono text-[11px] opacity-50 mb-3" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? "Noch keine Frage — stell die erste."}
          </p>
        )}

        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {questions.map((question) => (
              <motion.li
                key={question.key}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
              >
                <QuestionBlock
                  question={question}
                  answers={answersOf(question.key)}
                  onAnswer={(text) => answer(question.key, text)}
                  canDelete={question.seeded ? ctx.isOwner : true}
                  onDeleteQuestion={() =>
                    question.seeded ? removeSeeded(question.seedIndex) : deleteVoice(question.key)
                  }
                  onDeleteAnswer={(id) => deleteVoice(id)}
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
              className="w-full text-[13px] leading-relaxed bg-transparent outline-none resize-none p-2 rounded-[var(--v-radius)]"
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
  question,
  answers,
  onAnswer,
  canDelete,
  onDeleteQuestion,
  onDeleteAnswer,
}: {
  question: {
    key: string;
    text: string;
    answerHint?: string;
    seeded: boolean;
    actor?: { displayName?: string; color?: string };
  };
  answers: ModuleStateEntry[];
  onAnswer: (text: string) => Promise<void> | void;
  canDelete: boolean;
  onDeleteQuestion: () => void;
  onDeleteAnswer: (id: string) => void;
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
    <div className="group/q relative rounded-[var(--v-radius)] p-3" style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)" }}>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDeleteQuestion()}
          aria-label="Frage löschen"
          className="mono absolute right-2 top-2 text-[13px] opacity-0 transition-opacity group-hover/q:opacity-50 hover:!opacity-100"
          style={{ color: "var(--v-muted)" }}
        >
          ×
        </button>
      )}
      <div className="flex items-start gap-2.5">
        {question.seeded ? (
          <span
            className="mono inline-flex items-center justify-center shrink-0 rounded-full text-[10px]"
            style={{
              width: 16,
              height: 16,
              border: "1px dashed var(--v-rule)",
              color: "var(--v-muted)",
            }}
            aria-hidden
          >
            ?
          </span>
        ) : (
          <ActorDot
            color={question.actor?.color}
            displayName={question.actor?.displayName}
            size={16}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] leading-snug" style={{ color: "var(--v-fg)" }}>
            {question.text}
          </div>
          {!question.seeded && question.actor?.displayName && (
            <div className="mono text-[9px] tracking-widest mt-1 opacity-60" style={{ color: "var(--v-muted)" }}>
              {question.actor.displayName}
            </div>
          )}
        </div>
      </div>

      {answers.length > 0 && (
        <ul className="mt-2.5 pl-7 space-y-2">
          {answers.map((a) => {
            const aid = typeof a.data.id === "string" ? a.data.id : a.id;
            return (
              <li key={a.id} className="group/a flex items-start gap-2.5">
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
                <button
                  type="button"
                  onClick={() => onDeleteAnswer(aid)}
                  aria-label="Antwort löschen"
                  className="mono text-[12px] opacity-0 transition-opacity group-hover/a:opacity-50 hover:!opacity-100"
                  style={{ color: "var(--v-muted)" }}
                >
                  ×
                </button>
              </li>
            );
          })}
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
            placeholder={question.answerHint || "…"}
            className="w-full text-[12.5px] leading-relaxed bg-transparent outline-none resize-none p-2 rounded-[var(--v-radius)]"
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
