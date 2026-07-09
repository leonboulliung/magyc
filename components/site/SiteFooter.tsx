import Link from "next/link";
import Image from "next/image";
import { brand, FOOTER_GROUPS } from "@/lib/site";
import { SiteTrustAnchors } from "@/components/site/SiteTrustAnchors";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

/**
 * SiteFooter — link columns + wordmark. Stable across the marketing site.
 */
export function SiteFooter() {
  return (
    <>
      <SiteTrustAnchors />
      <footer className="shrink-0" style={{ borderTop: `1px solid ${brand.rule}`, background: "#e7e9e4" }}>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" aria-label="MAGYC" className="inline-flex items-center">
                <Image src="/magyc-logo.png" alt="MAGYC" width={182} height={40} className="h-[20px] w-auto" />
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
            className="mt-12 flex flex-col items-start justify-between gap-3 pt-6 sm:flex-row sm:items-center"
            style={{ borderTop: `1px solid ${brand.rule}` }}
          >
            <span className="font-mono tracking-widest" style={{ fontSize: 11, color: brand.muted }}>
              © {new Date().getFullYear()} MAGYC · magyc.site
            </span>
            <div className="flex items-center gap-4">
              {/* Real DE / EN toggle (cookie-based i18n). */}
              <LanguageSwitcher />
              <span className="font-mono tracking-widest" style={{ fontSize: 11, color: brand.muted }}>
                Für kreative Arbeit gebaut
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
