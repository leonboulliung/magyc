/**
 * Next Steps — abstract path forward. Read-only in v2. Could become
 * editable / claimable in a later iteration, but for now the role is
 * to make the shape of "how this could move" legible.
 */
export function PrimitiveNextSteps({ steps }: { steps: string[] }) {
  return (
    <section className="border border-rule rounded-2xl bg-surface">
      <div className="px-4 py-2.5 border-b border-rule mono text-[10px] tracking-widest opacity-70">
        SO KÖNNTE ES WEITERGEHEN
      </div>
      {steps.length === 0 ? (
        <div className="px-4 py-3 mono text-[11px] opacity-50">
          Noch nichts. Wenn das Vorhaben klarer wird, kann hier ein Pfad entstehen.
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
