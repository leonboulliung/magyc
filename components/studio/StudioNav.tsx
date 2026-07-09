"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useT } from "@/components/i18n/LocaleProvider";
import type { Dictionary } from "@/lib/i18n";

const ITEM_HREFS = ["/studio", "/studio/presets", "/studio/fast-prompts", "/studio/vertragsinhalte", "/studio/konnektoren", "/studio/users", "/studio/konto"] as const;

function itemsFor(t: Dictionary) {
  return [
    { href: ITEM_HREFS[0], label: t.studio.navStudio },
    { href: ITEM_HREFS[1], label: t.studio.navPresets },
    { href: ITEM_HREFS[2], label: t.studio.navFastPrompts },
    { href: ITEM_HREFS[3], label: t.studio.navContractContent },
    { href: ITEM_HREFS[4], label: t.studio.navConnectors },
    { href: ITEM_HREFS[5], label: t.studio.navUsers },
    { href: ITEM_HREFS[6], label: t.studio.navAccount },
  ];
}

function isActive(pathname: string, href: string): boolean {
  return href === "/studio" ? pathname === "/studio" : pathname.startsWith(href);
}

export function StudioNav() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const items = itemsFor(t);
  const current = items.find((i) => isActive(pathname, i.href)) ?? items[0];

  return (
    <>
      {/* Desktop: horizontal */}
      <nav className="hidden min-w-0 items-center gap-1 lg:flex">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative shrink-0 rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                active ? "text-black" : "text-black/50 hover:text-black/80"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="studio-nav-active"
                  className="absolute inset-0 rounded-full bg-black/[0.07]"
                  transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile/tablet: a clear menu button → dropdown */}
      <div className="relative lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={t.studio.menu}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-full border border-black/12 bg-black/[0.04] px-3.5 py-1.5 text-[13px] text-black"
        >
          {current.label}
          <span className="text-black/45 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
        </button>
        <AnimatePresence>
          {open && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-black/10 py-1.5 shadow-xl"
              style={{ background: "var(--studio-surface)" }}
            >
              {items.map((item) => {
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
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
