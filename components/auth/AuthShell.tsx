import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * Shared shell for the native Clerk sign-up / sign-in routes. Wraps the Clerk
 * widget in a branded two-column layout: a value panel (why MAGYC) beside the
 * form, so a cold lead who lands here from an ad email sees the promise before
 * the form — not a bare auth screen. Copy switches on `mode`.
 */

const COPY = {
  signup: {
    eyebrow: "Kostenlos starten",
    title: "Vom Shooting-Gedanken zum wasserfesten Vertrag.",
    sub: "Leg dein Konto an und verwandle in unter einer Minute einen Satz in eine fertige Projektseite — und mit einem Klick in einen rechtssicheren Vertrag.",
    alt: { q: "Schon ein Konto?", href: "/sign-in", label: "Anmelden" },
  },
  signin: {
    eyebrow: "Willkommen zurück",
    title: "Weiter, wo du aufgehört hast.",
    sub: "Melde dich an, um deine Projekte, Presets und Verträge zu verwalten.",
    alt: { q: "Noch kein Konto?", href: "/sign-up", label: "Kostenlos registrieren" },
  },
} as const;

const BULLETS = [
  "Aus einem Satz eine fertige Projektseite mit den richtigen Bausteinen",
  "Gemeinsam mit dem Kunden abstimmen — per Link, ohne operatives Chaos",
  "Ein Klick vom Plan zum abgestimmten, signierten Vertrag",
];

export function AuthShell({ mode, children }: { mode: "signup" | "signin"; children: ReactNode }) {
  const c = COPY[mode];
  return (
    <main className="min-h-screen w-full" style={{ background: "#f4f4f1", color: "#17171a" }}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8">
        <Link href="/" aria-label="MAGYC" className="flex items-center">
          <Image src="/magyc-logo.png" alt="MAGYC" width={182} height={40} className="h-[20px] w-auto" priority />
        </Link>

        <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-2 md:gap-16">
          <section className="order-2 md:order-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#e07a3f]">{c.eyebrow}</p>
            <h1 className="mt-4 font-brand text-[32px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[40px]">
              {c.title}
            </h1>
            <p className="mt-4 max-w-md font-body text-[15px] leading-7 text-[#4a4a48]">{c.sub}</p>
            <ul className="mt-7 space-y-3">
              {BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-3 font-body text-[14.5px] leading-6 text-[#2c2c2a]">
                  <span
                    aria-hidden
                    className="mt-[2px] inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full"
                    style={{ background: "rgba(224,122,63,0.14)", color: "#c9692f" }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.2l2.2 2.2L9.6 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 font-mono text-[11px] tracking-[0.06em] text-black/45">
              EU-gehostet · dokumentierte elektronische Signaturen
            </p>
          </section>

          <section className="order-1 flex flex-col items-center md:order-2 md:items-start">
            {children}
            <p className="mt-5 font-body text-[13.5px] text-[#6a6a66]">
              {c.alt.q}{" "}
              <Link href={c.alt.href} className="font-semibold text-[#c9692f] underline underline-offset-2">
                {c.alt.label}
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
