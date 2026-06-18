"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

const ITEMS = [
  { href: "/studio", label: "Studio", hint: "Projekte" },
  { href: "/studio/presets", label: "Presets", hint: "Workflows" },
  { href: "/studio/users", label: "Nutzer", hint: "Rechte" },
  { href: "/studio/profile", label: "Profil", hint: "Arbeitsweise" },
  { href: "/studio/settings", label: "Einstellungen", hint: "Regeln" },
] as const;

export function StudioSidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-white/8 bg-black/55 px-5 py-3 sm:border-b-0 sm:px-4 sm:py-8">
      <motion.nav
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
        }}
        className="mx-auto flex max-w-6xl gap-2 overflow-x-auto sm:sticky sm:top-20 sm:mx-0 sm:w-36 sm:flex-col sm:gap-1 sm:overflow-visible"
      >
        {ITEMS.map((item) => {
          const active = item.href === "/studio"
            ? pathname === "/studio"
            : pathname.startsWith(item.href);
          return (
            <motion.div
              key={item.href}
              variants={{
                hidden: { opacity: 0, x: -6 },
                show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
              }}
              className="shrink-0"
            >
              <Link
                href={item.href}
                className={`relative block overflow-hidden rounded-full border px-3 py-2 text-sm transition-colors sm:rounded-xl sm:px-3.5 sm:py-3 ${
                  active
                    ? "border-white/15 text-white"
                    : "border-transparent text-white/42 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/75"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="studio-sidebar-active"
                    className="absolute inset-0 bg-white/[0.07]"
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <span className="relative block leading-none">{item.label}</span>
                <span className={`relative mt-1 hidden text-[11px] leading-none sm:block ${active ? "text-white/45" : "text-white/22"}`}>
                  {item.hint}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>
    </aside>
  );
}
