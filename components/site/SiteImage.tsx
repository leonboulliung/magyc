import Image from "next/image";
import { brand } from "@/lib/site";

/**
 * SiteImage — a real image in the same framed, rounded box the
 * MediaPlaceholder uses, so swapping a placeholder for a real photo keeps
 * the layout identical. Uses next/image (fill + object-cover) for
 * optimization. `caption` renders the same small mono line below.
 */
export function SiteImage({
  src,
  alt,
  ratio = "16 / 10",
  caption,
  className,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority,
}: {
  src: string;
  alt: string;
  ratio?: string;
  caption?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ aspectRatio: ratio, border: `1px solid ${brand.rule}`, background: brand.accentSoft }}
      >
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} style={{ objectFit: "cover" }} />
      </div>
      {caption && (
        <figcaption className="mt-2 font-mono" style={{ fontSize: 11, color: brand.muted }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
