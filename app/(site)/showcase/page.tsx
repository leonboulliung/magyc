import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/site/sections";

export const metadata: Metadata = {
  title: "Showcase — MAGYC",
  description: "Eine Bandbreite echter Fotografie — vom Produkt-Shooting über Editorial bis Event und Hochzeit. MAGYC trägt das Projekt dahinter.",
};

/* Real photography across segments — a masonry gallery that makes the
   product feel like a tool built for photographers. Images live in
   public/media/showcase-*.jpg; `area` is a small caption tag. */
const GALLERY: { src: string; area: string; alt: string; w: number; h: number }[] = [
  { src: "/media/showcase-08.jpg", area: "Auf Tour", alt: "Fotograf bei Sonnenuntergang, Silhouette", w: 1120, h: 1400 },
  { src: "/media/showcase-03.jpg", area: "Editorial", alt: "Editorial-Porträt, schwarzer Blazer", w: 1400, h: 990 },
  { src: "/media/showcase-10.jpg", area: "Produkt", alt: "Luxusuhr auf dunklem Grund", w: 934, h: 1400 },
  { src: "/media/showcase-06.jpg", area: "Hochzeit", alt: "Brautpaar Hand in Hand", w: 1400, h: 933 },
  { src: "/media/showcase-05.jpg", area: "Event", alt: "Event in einer großen Halle", w: 1400, h: 933 },
  { src: "/media/showcase-02.jpg", area: "Produkt", alt: "Skincare-Stillleben mit Palmblatt", w: 933, h: 1400 },
  { src: "/media/showcase-07.jpg", area: "Editorial", alt: "Modeporträt in Rot vor blauem Himmel", w: 1400, h: 949 },
  { src: "/media/showcase-01.jpg", area: "Event", alt: "Anstoßen bei einer Feier mit Lichterketten", w: 1400, h: 933 },
  { src: "/media/showcase-09.jpg", area: "Porträt", alt: "Porträt im Schattenwurf, rostfarbener Blazer", w: 931, h: 1400 },
  { src: "/media/showcase-04.jpg", area: "Produkt", alt: "Sneaker, freigestellt", w: 1400, h: 1400 },
];

export default function ShowcasePage() {
  return (
    <Container className="pt-28 sm:pt-36 pb-28">
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/50">Showcase</p>
      <h1 className="mt-5 font-brand font-bold tracking-[-0.02em] text-white text-[38px] leading-[1.03] sm:text-[60px]" style={{ maxWidth: 820 }}>
        Eine Anwendung. Jede Art von Shooting.
      </h1>
      <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-white/65">
        Vom Produkt-Stillleben über Editorial bis Event und Hochzeit — die Bilder machst du.
        MAGYC trägt das Projekt dahinter: Briefing, Koordination, Übergabe.
      </p>

      <div className="mt-14 [column-fill:_balance] columns-1 gap-4 sm:columns-2 sm:gap-5 lg:columns-3">
        {GALLERY.map((g) => (
          <figure key={g.src} className="mb-4 break-inside-avoid sm:mb-5">
            <div className="relative overflow-hidden rounded-2xl border border-white/10">
              <Image
                src={g.src}
                alt={g.alt}
                width={g.w}
                height={g.h}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="h-auto w-full"
              />
              <span className="mono absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/85 backdrop-blur-sm">
                {g.area}
              </span>
            </div>
          </figure>
        ))}
      </div>

      <p className="mono mt-8 text-[11px] uppercase tracking-[0.2em] text-white/35">
        Echte Fotografie · Beispielbilder
      </p>
    </Container>
  );
}
