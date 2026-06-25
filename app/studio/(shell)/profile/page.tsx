"use client";

import { useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useStudioProfile } from "@/components/studio/useStudioProfile";
import { PageHeader, Card, Field, Input, Textarea, TagEditor } from "@/components/studio/formKit";
import { showActionError, showActionSuccess, showUnknownError } from "@/lib/client/feedback";

/**
 * Profil — the photographer's public-facing identity (name, headline, bio,
 * specialties). Autosaved via useStudioProfile. The avatar can be updated in
 * Clerk from this UI and the profile snapshot is kept in sync.
 */
export default function StudioProfilePage() {
  const { profile, status, update } = useStudioProfile();
  const { user } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  async function uploadAvatar(file: File | null) {
    if (!file || !user || avatarBusy) return;
    if (!file.type.startsWith("image/")) {
      showActionError("Profilbild nicht geändert", { description: "Bitte wähle eine Bilddatei aus." });
      return;
    }
    setAvatarBusy(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      update({ avatarUrl: user.imageUrl || null });
      showActionSuccess("Profilbild aktualisiert");
    } catch (error) {
      showUnknownError("Profilbild nicht geändert", error, { fallback: "Bitte erneut versuchen." });
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <PageHeader eyebrow="Studio · Profil" title="Profil" status={status}>
        Wer steht hinter dem Studio? Diese Angaben prägen deinen Auftritt und fließen
        als Dienstleister-Identität in deine Verträge.
      </PageHeader>

      {!profile ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : (
        <div className="mt-8 space-y-5">
          <Card>
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-[18px] font-semibold text-white"
                style={{ background: profile.color ?? "linear-gradient(135deg,#8b7bff,#39d2b4)" }}
              >
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (profile.displayName || "S").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-relaxed text-black/50">
                  Dein Profilbild wird in deinem Konto gespeichert und hier für Kundenansicht, Team und Freigaben genutzt.
                </p>
                <div className="mt-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => void uploadAvatar(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarBusy}
                    className="rounded-full border border-black/15 px-3.5 py-2 text-[13px] text-black/70 transition-colors hover:border-black/35 hover:text-black disabled:opacity-40"
                  >
                    {avatarBusy ? "Lädt …" : "Profilbild ändern"}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <Field label="Anzeigename" hint="Name oder Studioname, der nach außen erscheint.">
                <Input
                  value={profile.displayName}
                  onChange={(e) => update({ displayName: e.target.value })}
                  placeholder="z. B. Studio Lumen"
                  maxLength={80}
                />
              </Field>
              <Field label="Headline" hint="Ein Satz, der dich beschreibt.">
                <Input
                  value={profile.headline}
                  onChange={(e) => update({ headline: e.target.value })}
                  placeholder="z. B. Hochzeits- & Porträtfotografie in Köln"
                  maxLength={120}
                />
              </Field>
              <Field label="Über dich">
                <Textarea
                  value={profile.bio}
                  onChange={(e) => update({ bio: e.target.value })}
                  rows={4}
                  placeholder="Ein paar Sätze zu deiner Arbeit, deinem Stil, deinem Ansatz."
                  maxLength={600}
                />
              </Field>
            </div>
          </Card>

          <Card title="Schwerpunkte" hint="Womit arbeitest du? Per Enter hinzufügen.">
            <TagEditor
              items={profile.specialties}
              onAdd={(v) => update({ specialties: [...profile.specialties, v].slice(0, 24) })}
              onRemove={(i) => update({ specialties: profile.specialties.filter((_, j) => j !== i) })}
              placeholder="z. B. Hochzeit, Porträt, Editorial"
              glyph="◆"
              emptyHint="Noch keine Schwerpunkte."
              maxLength={60}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
