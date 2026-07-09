"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReverification, useUser } from "@clerk/nextjs";
import { useT } from "@/components/i18n/LocaleProvider";
import { useStudioProfile } from "@/components/studio/useStudioProfile";
import { LANGUAGE_OPTIONS } from "@/lib/studioProfile";
import { PageHeader, Card, Field, Input, Textarea, TagEditor, Segmented, Select, Toggle } from "@/components/studio/formKit";
import { showActionError, showActionSuccess, showUnknownError } from "@/lib/client/feedback";

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

/**
 * Konto — the account holder's own page: identity (name, headline, bio,
 * specialties, avatar, account email) and account-wide settings (defaults for
 * new projects, appearance). Merges the former Profil + Einstellungen pages;
 * team/client management stays on its own "Nutzer" page. Autosaved via
 * useStudioProfile.
 */
export default function StudioKontoPage() {
  const t = useT();
  const router = useRouter();
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

  const settings = profile?.settings;
  const set = (patch: Partial<NonNullable<typeof settings>>) => {
    if (!settings) return;
    update({ settings: { ...settings, ...patch } });
  };
  const setTheme = (projectTheme: "dark" | "light") => {
    document.documentElement.dataset.studioTheme = projectTheme;
    document.documentElement.style.colorScheme = projectTheme;
    set({ projectTheme });
    window.setTimeout(() => router.refresh(), 900);
  };

  async function uploadAvatar(file: File | null) {
    if (!file || !user || avatarBusy) return;
    if (!file.type.startsWith("image/")) {
      showActionError(t.studio.account.imageNotChanged, { description: t.studio.account.chooseImageFile });
      return;
    }
    setAvatarBusy(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      update({ avatarUrl: user.imageUrl || null });
      showActionSuccess(t.studio.account.avatarUpdated);
    } catch (error) {
      showUnknownError(t.studio.account.imageNotChanged, error, { fallback: t.studio.account.tryAgain });
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function beginEmailChange() {
    const nextEmail = email.trim().toLowerCase();
    if (!user || !nextEmail || emailBusy) return;
    if (user.emailAddresses.some((item) => item.emailAddress.toLowerCase() === nextEmail)) {
      showActionError(t.studio.account.emailNotChanged, { description: t.studio.account.emailAlreadyAdded });
      return;
    }
    setEmailBusy(true);
    try {
      const created = await createEmailAddress(nextEmail);
      await created.prepareVerification({ strategy: "email_code" });
      setPendingEmailId(created.id);
      setEmailCode("");
      showActionSuccess(t.studio.account.codeSent, { description: interpolate(t.studio.account.checkEmail, { email: nextEmail }) });
    } catch (error) {
      showUnknownError(t.studio.account.emailNotChanged, error, { fallback: t.studio.account.clerkEmailFailed });
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
      showActionSuccess(t.studio.account.emailUpdated);
    } catch (error) {
      showUnknownError(t.studio.account.codeNotConfirmed, error, { fallback: t.studio.account.checkCode });
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
      <PageHeader eyebrow={t.studio.account.eyebrow} title={t.studio.account.title} status={status}>
        {t.studio.account.intro}
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
                  (profile.displayName || "M").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-relaxed text-black/50">
                  {t.studio.account.avatarHint}
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
                    {avatarBusy ? t.common.loading : t.studio.account.changeAvatar}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title={t.studio.account.accountEmailTitle} hint={t.studio.account.accountEmailHint}>
            <div className="space-y-3">
              <div className="rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2.5">
                <span className="mono block text-[9px] uppercase tracking-widest text-black/35">{t.studio.account.current}</span>
                <span className="mt-1 block text-[14px] text-black/75">
                  {user?.primaryEmailAddress?.emailAddress || t.studio.account.loadingEmail}
                </span>
              </div>
              {!pendingEmailId ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void beginEmailChange(); } }}
                    placeholder={t.studio.account.newEmailPlaceholder}
                    autoComplete="email"
                    className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-[14px] text-[#17171a] outline-none placeholder:text-black/30 focus:border-black/45"
                  />
                  <button
                    type="button"
                    onClick={() => void beginEmailChange()}
                    disabled={emailBusy || !email.trim()}
                    className="shrink-0 rounded-xl bg-[#17171a] px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    {t.studio.account.sendCode}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-black/10 p-3.5">
                  <p className="text-[13px] leading-relaxed text-black/55">
                    {interpolate(t.studio.account.enterCode, { email: email.trim() })}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={emailCode}
                      onChange={(event) => setEmailCode(event.target.value.replace(/\s/g, ""))}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void confirmEmailChange(); } }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder={t.studio.account.codePlaceholder}
                      maxLength={12}
                      className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-[14px] text-[#17171a] outline-none placeholder:text-black/30 focus:border-black/45"
                    />
                    <button
                      type="button"
                      onClick={() => void confirmEmailChange()}
                      disabled={emailBusy || emailCode.trim().length < 4}
                      className="shrink-0 rounded-xl bg-[#17171a] px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                    >
                      {t.common.confirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => void cancelEmailChange()}
                      disabled={emailBusy}
                      className="rounded-xl px-3 py-2.5 text-[13px] text-black/45 transition-colors hover:bg-black/[0.04] hover:text-black"
                    >
                      {t.common.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <Field label={t.studio.account.displayName} hint={t.studio.account.displayNameHint}>
                <Input
                  value={profile.displayName}
                  onChange={(e) => update({ displayName: e.target.value })}
                  placeholder={t.studio.account.displayNamePlaceholder}
                  maxLength={80}
                />
              </Field>
              <Field label={t.studio.account.headline} hint={t.studio.account.headlineHint}>
                <Input
                  value={profile.headline}
                  onChange={(e) => update({ headline: e.target.value })}
                  placeholder={t.studio.account.headlinePlaceholder}
                  maxLength={120}
                />
              </Field>
              <Field label={t.studio.account.about}>
                <Textarea
                  value={profile.bio}
                  onChange={(e) => update({ bio: e.target.value })}
                  rows={4}
                  placeholder={t.studio.account.aboutPlaceholder}
                  maxLength={600}
                />
              </Field>
            </div>
          </Card>

          <Card title={t.studio.account.specialtiesTitle} hint={t.studio.account.specialtiesHint}>
            <TagEditor
              items={profile.specialties}
              onAdd={(v) => update({ specialties: [...profile.specialties, v].slice(0, 24) })}
              onRemove={(i) => update({ specialties: profile.specialties.filter((_, j) => j !== i) })}
              placeholder={t.studio.account.specialtiesPlaceholder}
              glyph="◆"
              emptyHint={t.studio.account.noSpecialties}
              maxLength={60}
            />
          </Card>

          {settings && (
            <>
              <Card title={t.studio.account.newProjectsTitle}>
                <div className="space-y-5">
                  <Field label={t.studio.account.defaultLanguage} hint={t.studio.account.defaultLanguageHint}>
                    <Select
                      value={settings.defaultLanguage}
                      onChange={(e) => set({ defaultLanguage: e.target.value })}
                      options={LANGUAGE_OPTIONS.map((l) => ({ value: l.value, label: l.label }))}
                    />
                  </Field>
                  <div className="h-px bg-black/[0.06]" />
                  <Toggle
                    checked={settings.defaultShared}
                    onChange={(v) => set({ defaultShared: v })}
                    label={t.studio.account.defaultShared}
                    hint={t.studio.account.defaultSharedHint}
                  />
                </div>
              </Card>

              <Card title={t.studio.account.appearanceTitle}>
                <Field label={t.studio.account.projectPage} hint={t.studio.account.projectPageHint}>
                  <div className="mt-2">
                    <Segmented
                      value={settings.projectTheme}
                      onChange={setTheme}
                      options={[
                        { value: "light", label: t.studio.account.light },
                        { value: "dark", label: t.studio.account.dark },
                      ]}
                    />
                  </div>
                </Field>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
