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
    <aside className="border-b border-white/8 bg-black/55 px-4 py-2.5 sm:border-b-0 sm:px-3 sm:py-6">
      <motion.nav
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
        }}
        className="mx-auto flex max-w-6xl gap-1 overflow-x-auto sm:sticky sm:top-20 sm:mx-0 sm:w-40 sm:flex-col sm:gap-0.5 sm:overflow-visible"
      >
        {ITEMS.map((item) => {
          const active = item.href === "/studio"
            ? pathname === "/studio"
            : pathname.startsWith(item.href);
          return (
            <motion.div
              key={item.href}
              variants={{
                hidden: { opacity: 0, x: -5 },
                show: { opacity: 1, x: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
              }}
              className="shrink-0"
            >
              <Link
                href={item.href}
                title={item.hint}
                className={`relative flex items-center gap-2.5 overflow-hidden rounded-full px-3 py-1.5 text-[13px] transition-colors sm:rounded-lg sm:px-2.5 sm:py-2 ${
                  active ? "text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="studio-sidebar-active"
                    className="absolute inset-0 rounded-full bg-white/[0.08] sm:rounded-lg"
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <span
                  aria-hidden
                  className="relative hidden h-1 w-1 shrink-0 rounded-full sm:block"
                  style={{ background: active ? "#fff" : "rgba(255,255,255,0.28)" }}
                />
                <span className="relative leading-none">{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>
    </aside>
  );
}
