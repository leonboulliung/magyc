"use client";

import { useRef, useState } from "react";
import { useReverification, useUser } from "@clerk/nextjs";
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
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [pendingEmailId, setPendingEmailId] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const createEmailAddress = useReverification(async (nextEmail: string) => {
    if (!user) throw new Error("account_unavailable");
    return user.createEmailAddress({ email: nextEmail });
  });

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

  async function beginEmailChange() {
    const nextEmail = email.trim().toLowerCase();
    if (!user || !nextEmail || emailBusy) return;
    if (user.emailAddresses.some((item) => item.emailAddress.toLowerCase() === nextEmail)) {
      showActionError("E-Mail-Adresse nicht geändert", { description: "Diese Adresse gehört bereits zu deinem Account." });
      return;
    }
    setEmailBusy(true);
    try {
      const created = await createEmailAddress(nextEmail);
      await created.prepareVerification({ strategy: "email_code" });
      setPendingEmailId(created.id);
      setEmailCode("");
      showActionSuccess("Bestätigungscode gesendet", { description: `Prüfe ${nextEmail}.` });
    } catch (error) {
      showUnknownError("E-Mail-Adresse nicht geändert", error, { fallback: "Clerk konnte die neue Adresse nicht vorbereiten." });
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmEmailChange() {
    if (!user || !pendingEmailId || emailCode.trim().length < 4 || emailBusy) return;
    setEmailBusy(true);
    try {
      let target = user.emailAddresses.find((item) => item.id === pendingEmailId);
      if (!target) {
        await user.reload();
        target = user.emailAddresses.find((item) => item.id === pendingEmailId);
      }
      if (!target) throw new Error("email_address_missing");
      const verified = await target.attemptVerification({ code: emailCode.trim() });
      if (verified.verification.status !== "verified") throw new Error("verification_failed");
      await user.update({ primaryEmailAddressId: verified.id });
      await user.reload();
      setEmail("");
      setEmailCode("");
      setPendingEmailId(null);
      showActionSuccess("E-Mail-Adresse aktualisiert");
    } catch (error) {
      showUnknownError("Code nicht bestätigt", error, { fallback: "Prüfe den Code und versuche es erneut." });
    } finally {
      setEmailBusy(false);
    }
  }

  async function cancelEmailChange() {
    if (!user || !pendingEmailId || emailBusy) return;
    const pending = user.emailAddresses.find((item) => item.id === pendingEmailId);
    setPendingEmailId(null);
    setEmailCode("");
    if (!pending || pending.verification.status === "verified") return;
    try {
      await pending.destroy();
      await user.reload();
    } catch {
      // Cancellation is local-first; Clerk can still expire the unused entry.
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

          <Card title="Account-E-Mail" hint="Die neue Adresse wird erst nach einem Bestätigungscode als primär gesetzt.">
            <div className="space-y-3">
              <div className="rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2.5">
                <span className="mono block text-[9px] uppercase tracking-widest text-black/35">Aktuell</span>
                <span className="mt-1 block text-[14px] text-black/75">
                  {user?.primaryEmailAddress?.emailAddress || "Wird geladen …"}
                </span>
              </div>
              {!pendingEmailId ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void beginEmailChange(); } }}
                    placeholder="Neue E-Mail-Adresse"
                    autoComplete="email"
                    className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-[14px] text-[#17171a] outline-none placeholder:text-black/30 focus:border-black/45"
                  />
                  <button
                    type="button"
                    onClick={() => void beginEmailChange()}
                    disabled={emailBusy || !email.trim()}
                    className="shrink-0 rounded-xl bg-[#17171a] px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    Code senden
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-black/10 p-3.5">
                  <p className="text-[13px] leading-relaxed text-black/55">
                    Gib den Code ein, den Clerk an <span className="text-black/80">{email.trim()}</span> gesendet hat.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={emailCode}
                      onChange={(event) => setEmailCode(event.target.value.replace(/\s/g, ""))}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void confirmEmailChange(); } }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Bestätigungscode"
                      maxLength={12}
                      className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-[14px] text-[#17171a] outline-none placeholder:text-black/30 focus:border-black/45"
                    />
                    <button
                      type="button"
                      onClick={() => void confirmEmailChange()}
                      disabled={emailBusy || emailCode.trim().length < 4}
                      className="shrink-0 rounded-xl bg-[#17171a] px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                    >
                      Bestätigen
                    </button>
                    <button
                      type="button"
                      onClick={() => void cancelEmailChange()}
                      disabled={emailBusy}
                      className="rounded-xl px-3 py-2.5 text-[13px] text-black/45 transition-colors hover:bg-black/[0.04] hover:text-black"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
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
