import { brand } from "@/lib/site";

/**
 * MediaPlaceholder — a clearly-marked free area where a real, creative
 * image (or video) goes later. Renders a dashed frame with a small label
 * and an optional caption slot, so the layout reads correctly while the
 * real media is still missing. No random stock images by design.
 */
export function MediaPlaceholder({
  label = "Image",
  ratio = "16 / 10",
  caption,
  className,
}: {
  label?: string;
  /** CSS aspect-ratio string, e.g. "16 / 10", "1 / 1", "4 / 5". */
  ratio?: string;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        className="relative w-full overflow-hidden rounded-2xl flex items-center justify-center"
        style={{
          aspectRatio: ratio,
          background: brand.accentSoft,
          border: `1px dashed ${brand.rule}`,
        }}
      >
        {/* faint diagonal hatch so it reads as "reserved", not broken */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.5]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${brand.rule} 10px, ${brand.rule} 11px)`,
          }}
        />
        <span
          className="relative font-mono uppercase tracking-[0.2em]"
          style={{ fontSize: 11, color: brand.muted }}
        >
          {label}
        </span>
      </div>
      {caption && (
        <figcaption className="mt-2 font-mono" style={{ fontSize: 11, color: brand.muted }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
