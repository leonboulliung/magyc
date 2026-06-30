import Image from "next/image";
import Link from "next/link";

const TRUST_ANCHORS = [
  {
    image: "/media/marketing/eidas.png",
    alt: "Europäisches Symbol für elektronische Vertrauensdienste",
    eyebrow: "E-Signaturen",
    title: "Nachvollziehbar im eIDAS-Rahmen",
    body: "MAGYC dokumentiert Name, Zeitpunkt, Signaturart und Vertragsstand. Elektronischen Signaturen darf nach Art. 25 eIDAS nicht allein wegen ihrer elektronischen Form die Rechtswirkung abgesprochen werden; das VDG ergänzt den deutschen Vertrauensdienste-Rahmen. MAGYC stellt derzeit keine qualifizierte elektronische Signatur bereit.",
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
    image: "/media/marketing/eu-hosting.png",
    alt: "EU-Symbol für geschützte Datenverarbeitung",
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
              <div className="flex h-16 w-16 items-center justify-center bg-white sm:h-[76px] sm:w-[76px]">
                <Image src={anchor.image} alt={anchor.alt} width={76} height={76} className="h-full w-full object-contain" />
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
