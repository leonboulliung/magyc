"use client";

import { useStrings } from "@/components/UIStringsProvider";

export function PrimitiveNextSteps({ steps }: { steps: string[] }) {
  const t = useStrings();
  return (
    <section className="border border-rule rounded-2xl bg-surface">
      <div className="px-4 py-2.5 border-b border-rule mono text-[10px] tracking-widest opacity-70">
        {t.primitives.nextStepsLabel}
      </div>
      {steps.length === 0 ? (
        <div className="px-4 py-3 mono text-[11px] opacity-50">
          {t.primitives.nextStepsEmpty}
        </div>
      ) : (
        <ol className="divide-y divide-rule">
          {steps.map((s, i) => (
            <li key={i} className="px-4 py-3 flex items-start gap-3">
              <span className="mono text-[10px] tracking-widest opacity-50 tabular-nums mt-1 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[15px] leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
