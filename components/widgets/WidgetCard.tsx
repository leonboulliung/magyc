"use client";

/**
 * Shared visual frame used by every non-header widget. Carries the
 * micro-title row and a consistent surface. Subjects can drop in
 * children freely.
 */
export function WidgetCard({
  microTitle,
  description,
  attribution,
  children,
  /** When true: no padding inside; child manages its own. */
  bare = false,
}: {
  microTitle?: React.ReactNode;
  description?: string;
  attribution?: { name: string; url: string; license: string };
  children: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <div
      className={`rounded-md ${bare ? "" : "p-4"} h-full`}
      style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)" }}
    >
      {microTitle && (
        <div
          className="mono text-[10px] tracking-widest uppercase mb-3"
          style={{ color: "var(--v-muted)" }}
        >
          {microTitle}
        </div>
      )}
      {children}
      {description && (
        <p
          className="mono text-[10px] mt-3"
          style={{ color: "var(--v-muted)" }}
        >
          {description}
        </p>
      )}
      {attribution && (
        <p
          className="mono text-[9px] mt-2 opacity-60"
          style={{ color: "var(--v-muted)" }}
        >
          ↗ {attribution.name} ·{" "}
          <a
            href={attribution.url}
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            {attribution.license}
          </a>
        </p>
      )}
    </div>
  );
}

/**
 * A small avatar dot — used everywhere attribution shows up. Reads the
 * actor's snapshotted colour from state.data.color and falls back to
 * a neutral hairline circle.
 */
export function ActorDot({
  color,
  displayName,
  size = 18,
}: {
  color?: string | null;
  displayName?: string;
  size?: number;
}) {
  const initial = (displayName || "?").slice(0, 1).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full mono"
      style={{
        width: size,
        height: size,
        background: color || "var(--v-rule)",
        color: color ? "#fff" : "var(--v-fg)",
        fontSize: Math.round(size * 0.45),
        lineHeight: 1,
        fontWeight: 600,
        textShadow: color ? "0 1px 1px rgba(0,0,0,0.15)" : "none",
      }}
      title={displayName}
      aria-label={displayName}
    >
      {initial}
    </span>
  );
}
