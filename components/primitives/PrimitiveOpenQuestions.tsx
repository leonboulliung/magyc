"use client";

import { useStrings } from "@/components/UIStringsProvider";

export function PrimitiveOpenQuestions({ questions }: { questions: string[] }) {
  const t = useStrings();
  if (!questions || questions.length === 0) return null;
  return (
    <section className="border border-rule rounded-2xl bg-surface">
      <div className="px-4 py-2.5 border-b border-rule mono text-[10px] tracking-widest opacity-70">
        {t.primitives.openQuestionsLabel}
      </div>
      <ul className="divide-y divide-rule">
        {questions.map((q, i) => (
          <li key={i} className="px-4 py-3 flex items-start gap-3">
            <span className="mono text-[10px] tracking-widest opacity-50 tabular-nums mt-1 shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[15px] leading-relaxed">{q}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
