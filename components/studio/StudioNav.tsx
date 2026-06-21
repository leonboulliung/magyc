"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/studio", label: "Studio" },
  { href: "/studio/presets", label: "Presets" },
  { href: "/studio/users", label: "Nutzer" },
  { href: "/studio/profile", label: "Profil" },
  { href: "/studio/settings", label: "Einstellungen" },
] as const;

export function StudioNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {ITEMS.map((item) => {
        const active = item.href === "/studio" ? pathname === "/studio" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] transition-colors ${
              active ? "bg-white/[0.08] text-white" : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
