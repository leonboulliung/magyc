import type { ReactNode } from "react";

/**
 * Standard page header for every Studio backend page — one eyebrow + title +
 * description + optional right-aligned action. Keeps all pages consistent.
 */
export function StudioPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">{eyebrow}</p>
          <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-white sm:text-[32px]">
            {title}
          </h1>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {description && (
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/55">{description}</p>
      )}
    </header>
  );
}

/** Tiny right-aligned save-state line ("Gespeichert" / "Speichert …"). */
export function SaveStatus({ status }: { status: "loading" | "saving" | "saved" | "error" }) {
  const text = status === "loading" ? "Lädt …"
    : status === "saving" ? "Speichert …"
    : status === "error" ? "Nicht gespeichert"
    : "Gespeichert";
  return (
    <span className="mono text-[11px] tracking-widest text-white/35">
      {status === "saved" ? "✓ " : ""}{text}
    </span>
  );
}
