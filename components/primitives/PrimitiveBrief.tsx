/**
 * Brief — one anchoring sentence the AI extracts as the "why" of the
 * space. Always rendered first. Read-only — visitors don't contribute
 * here, they engage with the surrounding primitives.
 */
export function PrimitiveBrief({ text }: { text: string }) {
  return (
    <section className="border-l-2 border-ink pl-4 py-1">
      <div className="mono text-[10px] tracking-widest opacity-60 mb-1.5">DAS HIER IST</div>
      <p className="editorial text-[18px] leading-snug">{text}</p>
    </section>
  );
}
