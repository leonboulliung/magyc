"use client";

import { useState } from "react";
import { StudioPageHeader, SaveStatus } from "@/components/studio/StudioPageHeader";
import { useStudioProfile } from "@/components/studio/useStudioProfile";

const inputClass =
  "w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35";
const cardClass = "rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6";

export default function StudioProfilePage() {
  const { profile, status, update } = useStudioProfile();
  const [specInput, setSpecInput] = useState("");

  const ready = !!profile;

  function addSpecialty() {
    const v = specInput.trim();
    setSpecInput("");
    if (!v || !profile) return;
    if (profile.specialties.includes(v)) return;
    update({ specialties: [...profile.specialties, v].slice(0, 24) });
  }

  function removeSpecialty(s: string) {
    if (!profile) return;
    update({ specialties: profile.specialties.filter((x) => x !== s) });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <StudioPageHeader
        eyebrow="Profil"
        title="Öffentliches Profil"
        description="Dein Name, deine Schwerpunkte und eine kurze Beschreibung — die Basis für Projektseiten und eine spätere öffentliche Referenzseite."
        action={<SaveStatus status={status} />}
      />

      {!ready ? (
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {/* Identity */}
          <section className={cardClass}>
            <div className="flex items-center gap-4">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white"
                  style={{ background: profile.color ?? "rgba(255,255,255,0.12)" }}
                >
                  {(profile.displayName || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="flex-1">
                <label className="mb-1.5 block text-[12px] uppercase tracking-widest text-white/40">Name</label>
                <input
                  value={profile.displayName}
                  onChange={(e) => update({ displayName: e.target.value })}
                  placeholder="z. B. Studio Lumen"
                  maxLength={80}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Headline */}
          <section className={cardClass}>
            <label className="mb-1.5 block text-[12px] uppercase tracking-widest text-white/40">Schwerpunkt</label>
            <input
              value={profile.headline}
              onChange={(e) => update({ headline: e.target.value })}
              placeholder="z. B. Produkt- & Editorial-Fotografie, Leipzig"
              maxLength={120}
              className={inputClass}
            />
          </section>

          {/* Specialties */}
          <section className={cardClass}>
            <label className="mb-2 block text-[12px] uppercase tracking-widest text-white/40">Spezialgebiete</label>
            <div className="flex flex-wrap items-center gap-2">
              {profile.specialties.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/80"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSpecialty(s)}
                    aria-label={`${s} entfernen`}
                    className="text-white/40 transition-colors hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={specInput}
                onChange={(e) => setSpecInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addSpecialty(); }
                  else if (e.key === "Backspace" && !specInput && profile.specialties.length) {
                    removeSpecialty(profile.specialties[profile.specialties.length - 1]);
                  }
                }}
                onBlur={addSpecialty}
                placeholder="Hinzufügen + Enter"
                maxLength={40}
                className="min-w-[160px] flex-1 bg-transparent px-1 py-1.5 text-[14px] text-white outline-none placeholder:text-white/30"
              />
            </div>
          </section>

          {/* Bio */}
          <section className={cardClass}>
            <label className="mb-1.5 block text-[12px] uppercase tracking-widest text-white/40">Beschreibung</label>
            <textarea
              value={profile.bio}
              onChange={(e) => update({ bio: e.target.value })}
              placeholder="Ein paar Sätze zu dir und deiner Arbeitsweise."
              rows={4}
              maxLength={600}
              className={`${inputClass} resize-none leading-relaxed`}
            />
            <p className="mono mt-2 text-right text-[10px] tabular-nums text-white/30">{profile.bio.length}/600</p>
          </section>
        </div>
      )}
    </div>
  );
}
