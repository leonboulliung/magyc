"use client";

import { useUser } from "@clerk/nextjs";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";

const cardClass = "rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6";

export default function StudioUsersPage() {
  const { user } = useUser();
  const name = user?.username || user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Du";

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <StudioPageHeader
        eyebrow="Nutzer"
        title="Team & Kunden"
        description="Wer Zugriff auf deine Projekte hat. Kunden arbeiten ohne Account über den Teilen-Link mit — Team-Einladungen mit Rollen folgen als nächster Schritt."
      />

      <div className="mt-8 space-y-5">
        {/* Account holder */}
        <section className={cardClass}>
          <h2 className="mb-4 text-[12px] uppercase tracking-widest text-white/40">Dein Studio</h2>
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.imageUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-white">{name}</span>
              <span className="block truncate text-[13px] text-white/45">
                {user?.primaryEmailAddress?.emailAddress ?? "—"}
              </span>
            </div>
            <span className="shrink-0 rounded-full border border-white/12 px-3 py-1 text-[12px] text-white/55">Inhaber</span>
          </div>
        </section>

        {/* Clients */}
        <section className={cardClass}>
          <h2 className="mb-2 text-[12px] uppercase tracking-widest text-white/40">Kundenzugänge</h2>
          <p className="text-[13.5px] leading-relaxed text-white/55">
            Kunden brauchen keinen Account: Du teilst ein Projekt über den Link
            (Projekt → Teilen). Sie können dann ansehen, kommentieren und Medien
            beisteuern, aber die Struktur nicht ändern.
          </p>
        </section>

        {/* Team — next */}
        <section className={`${cardClass} flex items-center justify-between gap-4`}>
          <div className="min-w-0">
            <h2 className="text-[15px] font-medium text-white">Teammitglieder einladen</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">
              Feste Mitarbeiter mit eigenem Login und Rollen — in Vorbereitung.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="shrink-0 cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-[13px] text-white/35"
          >
            Bald
          </button>
        </section>
      </div>
    </div>
  );
}
