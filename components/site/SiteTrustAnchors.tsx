import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Brand-drawn monoline marks instead of raster clip-art. The previous PNGs
 * were 500×500 RGB badges with a baked-in white background, so they rendered
 * as a hard white square clashing with the section canvas and blurred on
 * retina. Inline SVG stays crisp at any DPI, transparent, themeable via
 * currentColor, adds no request/layout-shift, and reads as intentional.
 */
const ICONS: Record<string, ReactNode> = {
  // Signed / verifiable document — documented electronic signature.
  signature: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="m8.5 13.5 2 2 4-4" />
    </>
  ),
  // Globe — data held in EU regions.
  region: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" />
    </>
  ),
};

const TRUST_ANCHORS = [
  {
    icon: "signature",
    eyebrow: "E-Signaturen",
    title: "Rechtsgültig unterschreiben — mit Prüfprotokoll",
    body: "Beide Seiten unterschreiben direkt im Projekt, per Textbestätigung oder gezeichneter Signatur. MAGYC hält Name, Zeitpunkt, Signaturart, IP und einen manipulationssicheren Inhalts-Hash des Vertrags in einem lückenlosen Prüfprotokoll fest. Nach Art. 25 eIDAS darf einer elektronischen Signatur die Rechtswirkung und die Zulässigkeit als Beweismittel nicht allein wegen ihrer elektronischen Form abgesprochen werden; das VDG ergänzt den deutschen Vertrauensdienste-Rahmen.",
    links: [
      {
        href: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32014R0910",
        label: "eIDAS-Verordnung",
        external: true,
      },
      {
        href: "https://www.gesetze-im-internet.de/vdg/",
        label: "Vertrauensdienstegesetz",
        external: true,
      },
    ],
  },
  {
    icon: "region",
    eyebrow: "EU-Hosting & DSGVO",
    title: "Projekt- und Mediendaten in EU-Regionen",
    body: "Datenbank und Storage laufen in Supabase eu-central-1, Serverfunktionen in Vercel fra1. Weitere eingesetzte Auftragsverarbeiter sind in der Datenschutzerklärung transparent benannt. EU-Hosting unterstützt eine DSGVO-konforme Verarbeitung; entscheidend bleiben auch Verträge, Einstellungen und Prozesse.",
    links: [{ href: "/legal/privacy", label: "Datenschutz im Detail", external: false }],
  },
] as const;

/** Shared trust strip shown directly before the footer on every marketing page. */
export function SiteTrustAnchors() {
  return (
    <section className="border-t border-black/10 bg-[#f4f4f1]" aria-labelledby="site-trust-heading">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <p className="mono text-[10px] uppercase tracking-[0.22em] text-black/42 sm:text-[11px]">
          Vertrauen & Infrastruktur
        </p>
        <h2 id="site-trust-heading" className="mt-3 max-w-3xl font-brand text-[28px] font-bold leading-[1.08] text-[#17171a] sm:text-[40px]">
          Verbindlich zusammenarbeiten. Datenstandorte transparent machen.
        </h2>

        <div className="mt-9 grid border-y border-black/12 md:grid-cols-2">
          {TRUST_ANCHORS.map((anchor, index) => (
            <article
              key={anchor.title}
              className={`grid grid-cols-[64px_1fr] gap-5 py-7 sm:grid-cols-[76px_1fr] sm:gap-6 sm:py-9 ${
                index === 1 ? "border-t border-black/12 md:border-l md:border-t-0 md:pl-9" : "md:pr-9"
              }`}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-black/10 bg-white text-[#17171a] shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:h-[76px] sm:w-[76px]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="h-8 w-8 sm:h-9 sm:w-9"
                >
                  {ICONS[anchor.icon]}
                </svg>
              </div>
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
