"use client";

import { useStrings } from "@/components/UIStringsProvider";

export function PrimitiveBrief({ text }: { text: string }) {
  const t = useStrings();
  return (
    <section className="border-l-2 border-ink pl-4 py-1">
      <div className="mono text-[10px] tracking-widest opacity-60 mb-1.5">{t.primitives.brief}</div>
      <p className="editorial text-[18px] leading-snug">{text}</p>
    </section>
  );
}
