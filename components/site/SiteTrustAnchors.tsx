"use client";

import Image from "next/image";
import Link from "next/link";
import { useT } from "@/components/i18n/LocaleProvider";

/** Shared trust strip shown directly before the footer on every marketing page. */
export function SiteTrustAnchors() {
  const t = useT();
  const TRUST_ANCHORS = [
    {
      image: "/media/marketing/eidas.png",
      alt: t.marketing.eidasAlt,
      eyebrow: t.marketing.eidasEyebrow,
      title: t.marketing.eidasTitle,
      body: t.marketing.eidasBody,
      links: [
        { href: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32014R0910", label: t.marketing.eidasLink1, external: true },
        { href: "https://www.gesetze-im-internet.de/vdg/", label: t.marketing.eidasLink2, external: true }, // i18n-ignore: URL
      ],
    },
    {
      image: "/media/marketing/dsgvo.png",
      alt: t.marketing.dsgvoAlt,
      eyebrow: t.marketing.dsgvoEyebrow,
      title: t.marketing.dsgvoTitle,
      body: t.marketing.dsgvoBody,
      links: [{ href: "/legal/privacy", label: t.marketing.dsgvoLink, external: false }],
    },
  ];
  return (
    <section className="border-t border-black/10 bg-[#f4f4f1]" aria-labelledby="site-trust-heading">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <p className="mono text-[10px] uppercase tracking-[0.22em] text-black/42 sm:text-[11px]">
          {t.marketing.trustEyebrow}
        </p>
        <h2 id="site-trust-heading" className="mt-3 max-w-3xl font-brand text-[28px] font-bold leading-[1.08] text-[#17171a] sm:text-[40px]">
          {t.marketing.trustHeading}
        </h2>

        <div className="mt-9 grid border-y border-black/12 md:grid-cols-2">
          {TRUST_ANCHORS.map((anchor, index) => (
            <article
              key={anchor.title}
              className={`grid grid-cols-[56px_1fr] items-start gap-5 py-7 sm:grid-cols-[68px_1fr] sm:gap-6 sm:py-9 ${
                index === 1 ? "border-t border-black/12 md:border-l md:border-t-0 md:pl-9" : "md:pr-9"
              }`}
            >
              <Image
                src={anchor.image}
                alt={anchor.alt}
                width={68}
                height={68}
                className="h-14 w-14 object-contain sm:h-[68px] sm:w-[68px]"
              />
              <div>
                <p className="mono text-[9px] uppercase tracking-[0.2em] text-black/40">{anchor.eyebrow}</p>
                <h3 className="mt-2 text-[17px] font-semibold text-[#17171a] sm:text-[19px]">{anchor.title}</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-black/58">{anchor.body}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                  {anchor.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noreferrer" : undefined}
                      className="inline-flex border-b border-black/25 pb-0.5 text-[13px] font-medium text-black/68 transition-colors hover:border-black hover:text-black"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
