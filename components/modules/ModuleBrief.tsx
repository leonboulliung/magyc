"use client";

/**
 * Brief module — display only. A single-sentence mission for a thing,
 * surfaced as a pull quote: an opening `❝` glyph hangs at the left, the
 * sentence reads in italic editorial type. No header, no chrome — the
 * glyph itself signals what this is. Owner-side affordances (edit /
 * remove / suggest) live in PostDetail, not here.
 */
export function ModuleBrief({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <span
        className="editorial font-black text-[56px] sm:text-[72px] leading-none -mt-3 sm:-mt-4 opacity-85 select-none shrink-0"
        aria-hidden
      >
        ❝
      </span>
      <p className="italic text-[18px] sm:text-[22px] leading-snug max-w-2xl pt-1 sm:pt-2">
        {text}
      </p>
    </div>
  );
}
