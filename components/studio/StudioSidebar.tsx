"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/studio", label: "Studiobereich" },
  { href: "/studio/presets", label: "Presets" },
  { href: "/studio/users", label: "Nutzer" },
  { href: "/studio/profile", label: "Profil" },
  { href: "/studio/settings", label: "Einstellungen" },
] as const;

export function StudioSidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-white/10 bg-black/70 px-5 py-3 sm:border-b-0 sm:border-r sm:px-4 sm:py-8">
      <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto sm:sticky sm:top-20 sm:mx-0 sm:w-44 sm:flex-col sm:overflow-visible">
        {ITEMS.map((item) => {
          const active = item.href === "/studio"
            ? pathname === "/studio"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-2 text-sm transition-colors sm:rounded-xl ${
                active
                  ? "bg-white text-black"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
