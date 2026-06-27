import type { ProjectFacts } from "@/lib/projectFacts";

export function ProjectFactsSummary({
  facts,
  title = "Projektstand",
  className = "",
}: {
  facts: ProjectFacts;
  title?: string;
  className?: string;
}) {
  const metrics = [
    ["Motive", facts.shots.length],
    ["Ergebnisse", facts.deliverables.length],
    ["Dateien", facts.uploads.length],
    ["Freigaben", facts.approvals.length],
    ["Aufgaben", facts.checklist.length],
  ].filter(([, value]) => Number(value) > 0) as [string, number][];
  const hasContent = metrics.length > 0
    || facts.dates.length > 0
    || facts.locations.length > 0
    || facts.workPackages.length > 0;
  if (!hasContent) return null;

  return (
    <section className={`border-y border-black/10 py-5 ${className}`}>
      <p className="mono text-[10px] uppercase tracking-[0.22em] text-black/40">{title}</p>
      {metrics.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-black/45">{label}</dt>
              <dd className="mt-0.5 text-[18px] font-semibold text-[#17171a]">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(facts.dates.length > 0 || facts.locations.length > 0) && (
        <div className="mt-4 grid gap-4 text-[13px] leading-relaxed sm:grid-cols-2">
          {facts.dates.length > 0 && (
            <div>
              <div className="text-black/40">Termine</div>
              <div className="mt-1 text-black/75">{facts.dates.slice(0, 4).join(" · ")}</div>
            </div>
          )}
          {facts.locations.length > 0 && (
            <div>
              <div className="text-black/40">Orte</div>
              <div className="mt-1 text-black/75">{facts.locations.slice(0, 4).join(" · ")}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
