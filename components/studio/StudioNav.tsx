"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/studio", label: "Studio" },
  { href: "/studio/presets", label: "Presets" },
  { href: "/studio/fast-prompts", label: "Schnellbausteine" },
  { href: "/studio/vertragsinhalte", label: "Vertragsinhalte" },
  { href: "/studio/konnektoren", label: "Konnektoren" },
  { href: "/studio/users", label: "Nutzer" },
  { href: "/studio/profile", label: "Profil" },
  { href: "/studio/settings", label: "Einstellungen" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/studio" ? pathname === "/studio" : pathname.startsWith(href);
}

export function StudioNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = ITEMS.find((i) => isActive(pathname, i.href)) ?? ITEMS[0];

  return (
    <>
      {/* Desktop: horizontal */}
      <nav className="hidden min-w-0 items-center gap-1 lg:flex">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                active ? "bg-black/[0.07] text-black" : "text-black/50 hover:bg-black/[0.04] hover:text-black/80"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile/tablet: a clear menu button → dropdown */}
      <div className="relative lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menü"
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-full border border-black/12 bg-black/[0.04] px-3.5 py-1.5 text-[13px] text-black"
        >
          {current.label}
          <span className="text-black/45 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-black/10 py-1.5 shadow-xl"
              style={{ background: "#ffffff" }}
            >
              {ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-2.5 text-[14px] transition-colors ${
                      active ? "bg-black/[0.06] text-black" : "text-black/70 hover:bg-black/[0.04] hover:text-black"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
