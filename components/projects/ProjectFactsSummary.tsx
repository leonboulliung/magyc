"use client";

import type { ProjectFacts } from "@/lib/projectFacts";
import { useT } from "@/components/i18n/LocaleProvider";

export function ProjectFactsSummary({
  facts,
  title,
  className = "",
}: {
  facts: ProjectFacts;
  title?: string;
  className?: string;
}) {
  const t = useT();
  const metrics = [
    [t.projectFacts.shots, facts.shots.length],
    [t.projectFacts.deliverables, facts.deliverables.length],
    [t.projectFacts.files, facts.uploads.length],
    [t.projectFacts.approvals, facts.approvals.length],
    [t.projectFacts.tasks, facts.checklist.length],
  ].filter(([, value]) => Number(value) > 0) as [string, number][];
  const hasContent = metrics.length > 0
    || facts.dates.length > 0
    || facts.locations.length > 0
    || facts.workPackages.length > 0;
  if (!hasContent) return null;

  return (
    <section className={`border-y border-black/10 py-5 ${className}`}>
      <p className="mono text-[10px] uppercase tracking-[0.22em] text-black/40">{title ?? t.projectFacts.defaultTitle}</p>
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
              <div className="text-black/40">{t.projectFacts.dates}</div>
              <div className="mt-1 text-black/75">{facts.dates.slice(0, 4).join(" · ")}</div>
            </div>
          )}
          {facts.locations.length > 0 && (
            <div>
              <div className="text-black/40">{t.projectFacts.places}</div>
              <div className="mt-1 text-black/75">{facts.locations.slice(0, 4).join(" · ")}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
