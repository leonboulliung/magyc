import Link from "next/link";
import { brand, FOOTER_GROUPS, LOCALES } from "@/lib/site";

/**
 * SiteFooter — link columns + wordmark. Stable across the marketing site.
 */
export function SiteFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${brand.rule}`, background: brand.bg }}>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" aria-label="MAGYC" className="inline-flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/magyc-logo.png" alt="MAGYC" className="h-[20px] w-auto" />
            </Link>
            <p className="mt-3 leading-relaxed" style={{ fontSize: 13, color: brand.muted, maxWidth: 220 }}>
              Eine Idee rein, eine lebendige, gemeinsame Struktur raus.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="font-mono uppercase tracking-widest" style={{ fontSize: 10, color: brand.muted }}>
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="transition-opacity hover:opacity-100" style={{ fontSize: 14, color: brand.ink, opacity: 0.8 }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{ borderTop: `1px solid ${brand.rule}` }}
        >
          <span className="font-mono tracking-widest" style={{ fontSize: 11, color: brand.muted }}>
            © {new Date().getFullYear()} MAGYC · magyc.site
          </span>
          <div className="flex items-center gap-4">
            {/* Language switch — EN goes live in Phase 5 (real /en routes). */}
            <div className="flex items-center gap-1.5" aria-label="Sprache">
              {LOCALES.map((l, i) => (
                <span key={l.code} className="flex items-center gap-1.5">
                  {i > 0 && <span style={{ color: brand.rule }}>·</span>}
                  {l.enabled ? (
                    <Link
                      href={l.href}
                      className="font-mono tracking-widest"
                      style={{ fontSize: 11, color: brand.ink, opacity: 0.9 }}
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <span
                      className="font-mono tracking-widest"
                      title="Englisch folgt"
                      style={{ fontSize: 11, color: brand.muted, opacity: 0.45, cursor: "not-allowed" }}
                    >
                      {l.label}
                    </span>
                  )}
                </span>
              ))}
            </div>
            <span className="font-mono tracking-widest" style={{ fontSize: 11, color: brand.muted }}>
              Für kreative Arbeit gebaut
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
