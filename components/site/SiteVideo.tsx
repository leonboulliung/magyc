"use client";

import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/site";

/**
 * SiteVideo — mirrors SiteImage so the marketing registry can mix stills and
 * short looping clips without changing the surrounding layout.
 *
 * Marketing clips can be several MB each. Autoplaying them all on load pushes
 * needless data onto mobile visitors and hurts LCP, so the real source is only
 * attached (and playback only starts) once the clip scrolls near the viewport.
 * Until then the poster/placeholder frame carries the layout. Visitors with
 * reduced-motion preference keep the poster and never autoplay.
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
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // keep the poster still; never autoplay heavy media
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ aspectRatio: ratio, border: `1px solid ${brand.rule}`, background: brand.accentSoft }}
      >
        <video
          ref={ref}
          className="h-full w-full object-cover"
          src={active ? src : undefined}
          poster={posterSrc}
          aria-label={alt}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
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
