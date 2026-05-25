"use client";

import { useState } from "react";
import { ACTIVITY_GLYPH, ACTIVITY_LABEL, CATEGORY_ORDER, type Activity } from "@/lib/vibe";
import type { Profile } from "@/lib/types";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/i;

interface Props {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}

export function ProfileEditor({ profile, onClose, onSaved }: Props) {
  const [username, setUsername] = useState(profile.displayName);
  const [instagram, setInstagram] = useState(profile.socials?.instagram || "");
  const [telegram, setTelegram] = useState(profile.socials?.telegram || "");
  const [whatsapp, setWhatsapp] = useState(profile.socials?.whatsapp || "");
  const [site, setSite] = useState(profile.socials?.site || "");
  const [interests, setInterests] = useState<Activity[]>(
    (profile.interests as Activity[] | null) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleInterest(a: Activity) {
    setInterests((arr) =>
      arr.includes(a) ? arr.filter((x) => x !== a) : [...arr, a],
    );
  }

  async function save() {
    const handle = username.trim().toLowerCase();
    if (!USERNAME_RE.test(handle)) {
      setError("Username must be 3–32 chars · letters, numbers, . _ - only.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: handle,
          socials: {
            instagram: instagram.trim(),
            telegram: telegram.trim(),
            whatsapp: whatsapp.trim(),
            site: site.trim(),
          },
          interests,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError((json?.error || "save failed").toString().toUpperCase());
        return;
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex sm:items-center sm:justify-center sm:bg-ink/60 sm:p-6">
      <div className="bg-paper flex flex-col w-full h-full sm:max-w-[600px] sm:max-h-[90vh] sm:h-auto sm:border sm:border-ink sm:shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink px-4 sm:px-6 py-3 sm:py-4 shrink-0 safe-top">
          <div className="mono text-[10px] tracking-widest opacity-70">EDIT · PROFILE</div>
          <button onClick={onClose} className="mono text-[11px] tracking-widest hover:underline">
            CLOSE ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          <div>
            <label className="mono text-[10px] tracking-widest opacity-70">USERNAME</label>
            <div className="flex items-center mt-1 border border-ink">
              <span className="mono text-[14px] px-3 py-3 border-r border-ink bg-ink text-paper">@</span>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="mono text-[14px] flex-1 px-3 py-3 bg-white focus:outline-none"
                maxLength={32}
              />
            </div>
            <p className="mono text-[10px] opacity-50 mt-1">
              3–32 chars · letters, numbers, . _ -
            </p>
          </div>

          <div className="space-y-3">
            <label className="mono text-[10px] tracking-widest opacity-70">SOCIALS</label>
            <Field prefix="@" label="INSTAGRAM" value={instagram} onChange={setInstagram} />
            <Field prefix="@" label="TELEGRAM" value={telegram} onChange={setTelegram} />
            <Field prefix="+" label="WHATSAPP" value={whatsapp} onChange={setWhatsapp} placeholder="33 6 12 34 56 78" />
            <Field prefix="↗" label="WEBSITE" value={site} onChange={setSite} placeholder="https://your.site" />
          </div>

          <div>
            <label className="mono text-[10px] tracking-widest opacity-70">INTERESTS</label>
            <p className="mono text-[10px] opacity-50 mt-1">Tap what you'd want company for.</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CATEGORY_ORDER.map((c) => {
                const active = interests.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleInterest(c)}
                    className={`aspect-[3/2] border border-ink flex flex-col items-center justify-center gap-1 transition ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                    aria-pressed={active}
                  >
                    <span className="text-[20px] leading-none">{ACTIVITY_GLYPH[c]}</span>
                    <span className="mono text-[10px] tracking-widest">
                      {ACTIVITY_LABEL[c]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="mono text-[11px] text-red-700">{error}</p>}

          <p className="mono text-[10px] opacity-50 border-t border-rule pt-4">
            Want to change your avatar? Click your avatar in the top-right and pick
            „Manage account" — handled by Clerk.
          </p>
        </div>

        <div
          className="border-t border-ink px-4 sm:px-6 py-3 flex justify-end gap-2 shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          <button onClick={onClose} className="btn ghost" disabled={saving}>
            Cancel
          </button>
          <button onClick={save} className="btn" disabled={saving}>
            {saving ? "Saving…" : "Save →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  prefix,
  label,
  value,
  onChange,
  placeholder,
}: {
  prefix: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center border border-ink">
      <span className="mono text-[11px] tracking-widest px-3 py-2.5 border-r border-ink bg-ink text-paper w-28">
        {prefix} {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "handle"}
        className="mono text-[13px] flex-1 px-3 py-2.5 bg-white focus:outline-none"
        maxLength={120}
      />
    </div>
  );
}
