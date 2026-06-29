import { brand } from "@/lib/site";

/**
 * SiteVideo — mirrors SiteImage so the marketing registry can mix stills and
 * short looping clips without changing the surrounding layout.
 */
export function SiteVideo({
  src,
  alt,
  ratio = "16 / 10",
  caption,
  className,
  posterSrc,
}: {
  src: string;
  alt: string;
  ratio?: string;
  caption?: string;
  className?: string;
  posterSrc?: string;
}) {
  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ aspectRatio: ratio, border: `1px solid ${brand.rule}`, background: brand.accentSoft }}
      >
        <video
          className="h-full w-full object-cover"
          src={src}
          poster={posterSrc}
          aria-label={alt}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 font-mono" style={{ fontSize: 11, color: brand.muted }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
