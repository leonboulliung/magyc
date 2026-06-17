"use client";

import { useEffect, useMemo, useState } from "react";

type PresetKey = "product" | "editorial" | "event";
type ContactKind = "team" | "client";

type Preset = {
  key: PresetKey;
  name: string;
  description: string;
  modules: string[];
};

type Contact = {
  id: string;
  kind: ContactKind;
  name: string;
  role: string;
};

type ProfileDraft = {
  slug: string;
  focuses: string[];
  bio: string;
};

type StoredSettings = {
  presets: Preset[];
  profile: ProfileDraft;
  contacts: Contact[];
};

const MODULE_LABELS: Record<string, string> = {
  moodboard: "Moodboard",
  shot_list: "Shotlist",
  locations_multi: "Locations",
  appointment: "Termin",
  crew: "Team",
  checklist: "Checkliste",
  deliverables: "Deliverables",
  approvals: "Freigaben",
  attachments: "Referenzen",
};

const DEFAULT_PRESETS: Preset[] = [
  {
    key: "product",
    name: "Produktshooting",
    description: "Für Packshots, Editorials und Webshop-Serien.",
    modules: ["moodboard", "shot_list", "deliverables", "approvals", "attachments"],
  },
  {
    key: "editorial",
    name: "Editorial",
    description: "Für Kampagnen mit Look, Styling, Crew und Motiven.",
    modules: ["moodboard", "shot_list", "crew", "locations_multi", "checklist"],
  },
  {
    key: "event",
    name: "Event",
    description: "Für Ablauf, Rollen, Motive und schnelle Übergabe.",
    modules: ["shot_list", "appointment", "crew", "deliverables", "approvals"],
  },
];

const DEFAULT_PROFILE: ProfileDraft = {
  slug: "deinname",
  focuses: ["Mode", "Produktfotografie"],
  bio: "Fotografie mit klarer Planung, ruhiger Produktion und sauberer Auswahl.",
};

const DEFAULT_CONTACTS: Contact[] = [
  { id: "1", kind: "team", name: "Assistenz", role: "Set / Licht" },
  { id: "2", kind: "client", name: "Kunde", role: "Freigabe" },
];

const STORAGE_KEY = "magyc.studio.settings.v1";

export function StudioSettingsPanel() {
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [profile, setProfile] = useState<ProfileDraft>(DEFAULT_PROFILE);
  const [contacts, setContacts] = useState<Contact[]>(DEFAULT_CONTACTS);
  const [newFocus, setNewFocus] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactKind, setContactKind] = useState<ContactKind>("client");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredSettings>;
      if (Array.isArray(parsed.presets)) setPresets(parsed.presets);
      if (parsed.profile) setProfile({ ...DEFAULT_PROFILE, ...parsed.profile });
      if (Array.isArray(parsed.contacts)) setContacts(parsed.contacts);
    } catch {
      // Local drafts are convenience state. Invalid storage should never block Studio.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ presets, profile, contacts }));
  }, [presets, profile, contacts]);

  const moduleOptions = useMemo(() => Object.entries(MODULE_LABELS), []);

  function toggleModule(presetKey: PresetKey, moduleKey: string) {
    setPresets((items) =>
      items.map((preset) => {
        if (preset.key !== presetKey) return preset;
        const hasModule = preset.modules.includes(moduleKey);
        return {
          ...preset,
          modules: hasModule
            ? preset.modules.filter((item) => item !== moduleKey)
            : [...preset.modules, moduleKey],
        };
      }),
    );
  }

  function addFocus() {
    const value = newFocus.trim();
    if (!value || profile.focuses.includes(value)) return;
    setProfile((current) => ({ ...current, focuses: [...current.focuses, value] }));
    setNewFocus("");
  }

  function addContact() {
    const name = contactName.trim();
    if (!name) return;
    setContacts((items) => [
      ...items,
      {
        id: `${Date.now()}`,
        kind: contactKind,
        name,
        role: contactRole.trim() || (contactKind === "team" ? "Team" : "Kunde"),
      },
    ]);
    setContactName("");
    setContactRole("");
  }

  return (
    <section className="mt-14 space-y-5">
      <div>
        <p className="mono text-[10px] uppercase tracking-[0.22em] text-white/35">Studio-Einstellungen</p>
        <h2 className="mt-2 font-brand text-[24px] font-bold tracking-[-0.01em] text-white sm:text-[30px]">
          Wiederholbare Abläufe vorbereiten
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-2xl border border-white/12 bg-white/[0.025] p-5">
          <p className="mono text-[10px] uppercase tracking-[0.2em] text-white/40">Element-Presets</p>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Wähle, welche Elemente bei einem Projekttyp automatisch vorbereitet werden.
          </p>
          <div className="mt-5 space-y-4">
            {presets.map((preset) => (
              <div key={preset.key} className="rounded-xl border border-white/10 bg-black/35 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-body text-[15px] font-semibold text-white">{preset.name}</p>
                    <p className="mt-1 text-[13px] text-white/45">{preset.description}</p>
                  </div>
                  <span className="mono rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/45">
                    {preset.modules.length} Elemente
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {moduleOptions.map(([moduleKey, label]) => {
                    const active = preset.modules.includes(moduleKey);
                    return (
                      <button
                        key={moduleKey}
                        type="button"
                        onClick={() => toggleModule(preset.key, moduleKey)}
                        className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                          active
                            ? "border-white/70 bg-white text-black"
                            : "border-white/12 text-white/55 hover:border-white/35 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/12 bg-white/[0.025] p-5">
            <p className="mono text-[10px] uppercase tracking-[0.2em] text-white/40">Öffentliches Profil</p>
            <label className="mt-4 block text-[12px] text-white/45">Profilname</label>
            <div className="mt-2 flex rounded-xl border border-white/12 bg-black/35">
              <input
                value={profile.slug}
                onChange={(e) =>
                  setProfile((current) => ({
                    ...current,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  }))
                }
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                placeholder="profilname"
              />
              <span className="border-l border-white/10 px-3 py-2.5 text-sm text-white/35">.magyc.site</span>
            </div>
            <label className="mt-4 block text-[12px] text-white/45">Beschreibung</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile((current) => ({ ...current, bio: e.target.value }))}
              rows={3}
              className="mt-2 w-full resize-none rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/25"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.focuses.map((focus) => (
                <button
                  key={focus}
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      focuses: current.focuses.filter((item) => item !== focus),
                    }))
                  }
                  className="rounded-full border border-white/12 px-3 py-1.5 text-[12px] text-white/65 hover:border-white/35"
                  title="Schwerpunkt entfernen"
                >
                  {focus} x
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newFocus}
                onChange={(e) => setNewFocus(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addFocus();
                }}
                className="min-w-0 flex-1 rounded-full border border-white/12 bg-black/35 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                placeholder="Schwerpunkt"
              />
              <button type="button" onClick={addFocus} className="rounded-full border border-white/20 px-4 text-sm text-white hover:bg-white/10">
                +
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/[0.025] p-5">
            <p className="mono text-[10px] uppercase tracking-[0.2em] text-white/40">Team & Kunden</p>
            <div className="mt-4 space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-white">{contact.name}</p>
                    <p className="text-[12px] text-white/40">
                      {contact.kind === "team" ? "Team" : "Kunde"} · {contact.role}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContacts((items) => items.filter((item) => item.id !== contact.id))}
                    className="text-sm text-white/35 hover:text-white"
                    aria-label={`${contact.name} entfernen`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[0.7fr_1fr_1fr_auto]">
              <select
                value={contactKind}
                onChange={(e) => setContactKind(e.target.value as ContactKind)}
                className="rounded-full border border-white/12 bg-black px-3 py-2 text-sm text-white outline-none"
              >
                <option value="client">Kunde</option>
                <option value="team">Team</option>
              </select>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Name"
                className="rounded-full border border-white/12 bg-black/35 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
              />
              <input
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                placeholder="Rolle"
                className="rounded-full border border-white/12 bg-black/35 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
              />
              <button type="button" onClick={addContact} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/85">
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
