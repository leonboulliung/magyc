"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto sm:sticky sm:top-20 sm:mx-0 sm:w-36 sm:flex-col sm:gap-1 sm:overflow-visible">
        {ITEMS.map((item) => {
          const active = item.href === "/studio"
            ? pathname === "/studio"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full border px-3 py-2 text-sm transition-colors sm:rounded-xl sm:px-3.5 sm:py-3 ${
                active
                  ? "border-white/15 bg-white/[0.07] text-white"
                  : "border-transparent text-white/42 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/75"
              }`}
            >
              <span className="block leading-none">{item.label}</span>
              <span className={`mt-1 hidden text-[11px] leading-none sm:block ${active ? "text-white/45" : "text-white/22"}`}>
                {item.hint}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
