/**
 * Place — when the input mentioned a real location. Read-only label;
 * we don't geocode in v2 yet (the input can be vague — a city, a
 * neighborhood — and any auto-resolve would risk inventing).
 */
export function PrimitivePlace({ label }: { label: string }) {
  return (
    <section className="border border-rule rounded-2xl bg-surface px-4 py-3 flex items-center gap-2.5">
      <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      <div>
        <div className="mono text-[10px] tracking-widest opacity-60">ORT</div>
        <div className="text-[15px] leading-snug">{label}</div>
      </div>
    </section>
  );
}
