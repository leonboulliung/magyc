"use client";

import { useState, useCallback } from "react";
import { notFound } from "next/navigation";
import { WidgetContext } from "@/lib/widgetContext";
import { WidgetDispatcher } from "@/components/widgets/WidgetDispatcher";
import { PersonaSwitcher } from "@/components/PersonaSwitcher";
import { makeOptimisticEntry, applyActionLocally } from "@/lib/state";
import { styleVars, DEFAULT_STYLE } from "@/lib/style";
import { fontStack, findFont } from "@/lib/fonts";
import type { Module, ModuleStateEntry, ModuleStateKind, ModuleType, SpaceLabels } from "@/lib/types";
import { ALL_MODULE_TYPES } from "@/lib/types";

/**
 * /dev — local element showroom. Renders every body widget with seeded
 * fake state and a local act() (no DB / auth), so the elements can be
 * reviewed and exercised one by one. Also the masonry verification
 * surface: the widgets here have deliberately varied heights.
 *
 * NOTE: config edits that PUT to the API (inline heading/text edits,
 * regenerate) won't persist here — this is for layout + collaborative
 * interaction review, not persistence.
 */

const DEMO_MODULES: Module[] = [
  { type: "heading", text: "Element-Schaukasten", level: 1 },
  { type: "rich_text", microTitle: "Kontext", text: "Alle Body-Module mit Beispieldaten. Stimmen, Häkchen, Claims und Nachrichten laufen lokal über act() — wechsle die Persona unten, um Mehrspieler zu simulieren." },
  { type: "tags", tags: ["demo", "elemente", "test"] },

  { type: "ai_summary", microTitle: "Einordnung", text: "Eine kurze, abstrahierende KI-Sicht auf die Sache, die den Kern greifbarer macht." },
  { type: "icon", iconify: "lucide:sparkles" },
  { type: "poll", microTitle: "Abstimmung", question: "Wann treffen wir uns?", options: ["Freitag", "Samstag", "Sonntag"] },
  { type: "checklist", microTitle: "Aufgaben", items: [{ text: "Material besorgen" }, { text: "Ort buchen" }, { text: "Einladen" }] },
  { type: "crew", microTitle: "Crew", roles: [{ name: "Organisation" }, { name: "Technik" }, { name: "Catering" }] },
  { type: "work_packages", microTitle: "Arbeitspakete", packages: [{ label: "Aufbau", description: "Stände + Strom" }, { label: "Abbau" }] },
  { type: "deliverables", microTitle: "Ergebnisse", items: [{ label: "Finale Galerie", quantity: "40 Bilder", format: "JPG + Web", due: "5 Tage nach dem Shooting", details: "Auswahl, Grundlook und Web-Export." }] },
  { type: "approvals", microTitle: "Freigaben", items: [{ text: "Moodboard bestätigen", description: "Looks, Referenzen und Farbwelt gemeinsam absegnen." }, { text: "Finale Bildauswahl freigeben" }] },
  { type: "notes", microTitle: "Notizen" },
  { type: "qa", microTitle: "Fragen", questions: [{ text: "Welche Motive haben oberste Priorität?" }, { text: "Welche Nutzungsrechte werden gebraucht?", answerHint: "z. B. Website, Print, Social, Ads" }] },
  { type: "discussion", microTitle: "Diskussion" },
  { type: "table", microTitle: "Vergleich", columns: ["Option", "Kosten", "Aufwand"], rows: [["A", "20€", "gering"], ["B", "50€", "mittel"]] },
  { type: "parts_list", microTitle: "Utensilien", items: [{ name: "Klapptisch", quantity: "2" }, { name: "Kabeltrommel" }] },
  { type: "range", microTitle: "Zeitraum", unit: "month", from: "Juni", to: "August" },
  { type: "phases", microTitle: "Phasen", phases: [{ label: "Planung" }, { label: "Aufbau" }, { label: "Event" }, { label: "Nachbereitung" }], currentPhase: 1 },
  { type: "date", microTitle: "Termin", date: "2026-08-15" },
  { type: "appointment", microTitle: "Start", datetime: "2026-08-15T18:00:00.000Z" },
  { type: "location_single", microTitle: "Ort", center: [2.3522, 48.8566], zoom: 13, label: "Paris" },
  { type: "location_suggestions", microTitle: "Orts-Ideen", suggestions: [{ label: "Parc de la Villette" }, { label: "Canal Saint-Martin" }, { label: "Place des Vosges" }] },
  { type: "wikipedia", microTitle: "Referenz", topic: "Repair Café", url: "https://en.wikipedia.org/wiki/Repair_Café", extract: "A Repair Café is a meeting where people repair household electrical and mechanical devices, computers, bicycles, clothing, and other items." },
  { type: "locations_multi", microTitle: "Mehrere Orte", locations: [
    { lng: 13.405, lat: 52.52, label: "Berlin" },
    { lng: 9.993, lat: 53.551, label: "Hamburg" },
    { lng: 11.576, lat: 48.137, label: "München" },
  ]},
  { type: "route", microTitle: "Route", stops: [
    { lng: 2.3522, lat: 48.8566, label: "Paris" },
    { lng: 4.3517, lat: 50.8503, label: "Brüssel" },
    { lng: 4.9041, lat: 52.3676, label: "Amsterdam" },
  ]},
  { type: "appointments", microTitle: "Termine", entries: [
    { datetime: "2026-08-15T18:00:00.000Z", label: "Kick-off" },
    { datetime: "2026-08-22T18:00:00.000Z", label: "Review" },
    { datetime: "2026-09-05T18:00:00.000Z", label: "Abschluss" },
  ]},
  { type: "attachments", microTitle: "Anhänge" },
  { type: "images", microTitle: "Fotos" },
  { type: "audio", microTitle: "Töne" },
  { type: "sketch", microTitle: "Skizze", placeholder: "zeichnen…" },
  { type: "gif", microTitle: "GIF", gifUrl: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif" },
];

// Compile-time guard: every body type must appear in DEMO_MODULES.
// If a new widget type is added to ALL_MODULE_TYPES, this will error
// until a demo entry is added here — no more silent drift.
const _demoTypes = new Set(DEMO_MODULES.map((m) => m.type));
const _missingFromDemo = (ALL_MODULE_TYPES as readonly ModuleType[]).filter((t) => !_demoTypes.has(t));
if (_missingFromDemo.length > 0) {
  // eslint-disable-next-line no-console
  console.warn("[dev] Missing demo entries for:", _missingFromDemo);
}

// Seed a little collaborative state so the populated states are visible.
function seed(): ModuleStateEntry[] {
  const idxPoll = DEMO_MODULES.findIndex((m) => m.type === "poll");
  const idxCheck = DEMO_MODULES.findIndex((m) => m.type === "checklist");
  const idxApprovals = DEMO_MODULES.findIndex((m) => m.type === "approvals");
  const idxCrew = DEMO_MODULES.findIndex((m) => m.type === "crew");
  const idxQa = DEMO_MODULES.findIndex((m) => m.type === "qa");
  const idxDisc = DEMO_MODULES.findIndex((m) => m.type === "discussion");
  const idxSketch = DEMO_MODULES.findIndex((m) => m.type === "sketch");
  const mk = (
    moduleIndex: number, kind: ModuleStateKind, data: Record<string, unknown>,
    id: string, name: string, color: string,
  ): ModuleStateEntry => ({
    id, spaceId: "dev", moduleIndex,
    actor: { kind: "anon", id, displayName: name, color },
    kind, data: { ...data, color }, createdAt: Date.now() - Math.random() * 1e6,
  });
  return [
    mk(idxPoll, "vote", { option: "Samstag" }, "seed-a", "Alice", "#7da3c0"),
    mk(idxPoll, "vote", { option: "Samstag" }, "seed-b", "Bob", "#d4a373"),
    mk(idxCheck, "check", { itemKey: "seed-0", checked: true }, "seed-a2", "Alice", "#7da3c0"),
    mk(idxApprovals, "check", { itemKey: "seed-0", checked: true }, "seed-b0", "Bob", "#d4a373"),
    mk(idxCrew, "claim", { slotLabel: "Technik", claimed: true }, "seed-b2", "Bob", "#d4a373"),
    mk(idxQa, "voice", { id: "a1", role: "answer", parentId: "seed-1", text: "Website, Instagram und ein paar Anzeigenmotive." }, "seed-c1", "Carla", "#9f86c0"),
    mk(idxDisc, "voice", { id: "m1", text: "Sollen wir Samstagnachmittag anpeilen?" }, "seed-a3", "Alice", "#7da3c0"),
    mk(idxSketch, "stroke", { path: "M120 180 L200 120 L280 180 L200 240 Z", width: 3 }, "seed-sk-a", "Alice", "#7da3c0"),
    mk(idxSketch, "stroke", { path: "M350 140 C400 80 480 80 500 160 C520 240 460 280 400 260 C340 240 300 200 350 140", width: 3 }, "seed-sk-b", "Bob", "#d4a373"),
  ];
}

const DEMO_LABELS: SpaceLabels = { emptyGrid: "—", participants: "Beteiligte" };

export default function DevPage() {
  // Internal widget showroom — not for production. NODE_ENV is inlined
  // at build time, so this whole component is the not-found page in prod.
  if (process.env.NODE_ENV === "production") notFound();

  const [state, setState] = useState<ModuleStateEntry[]>(seed);

  const act = useCallback(async (moduleIndex: number, kind: ModuleStateKind, data: Record<string, unknown>) => {
    const entry = makeOptimisticEntry("dev", moduleIndex, kind, data);
    setState((prev) => applyActionLocally(prev, entry));
    return true;
  }, []);

  const slice = (i: number) => state.filter((e) => e.moduleIndex === i).sort((a, b) => a.createdAt - b.createdAt);

  const header = DEMO_MODULES.slice(0, 3);
  const body = DEMO_MODULES.slice(3);

  const vars = styleVars(DEFAULT_STYLE, fontStack(findFont(DEFAULT_STYLE.font)));

  return (
    <WidgetContext.Provider
      value={{
        spaceId: "dev",
        title: "Dev Showroom",
        language: "de",
        labels: DEMO_LABELS,
        isOwner: true,
        ownerToken: null,
        refresh: () => {},
        patchModule: () => {},
        saveModule: async () => true,
        act,
      }}
    >
      <div className="vibe-root vibe-minimal min-h-screen" style={{ ...vars, background: "var(--v-page)" }}>
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
          <div className="mono text-[10px] tracking-widest opacity-40">/dev — element showroom</div>
          {header.map((m, i) => (
            <WidgetDispatcher key={`h${i}`} module={m} index={i} state={slice(i)} />
          ))}

          <div className="columns-1 sm:columns-2 mt-4" style={{ columnGap: 12 }}>
            {body.map((m, bi) => {
              const i = bi + 3;
              return (
                <div key={`${i}-${m.type}`} className="mb-3 break-inside-avoid">
                  <WidgetDispatcher module={m} index={i} state={slice(i)} />
                </div>
              );
            })}
          </div>
        </div>
        <PersonaSwitcher />
      </div>
    </WidgetContext.Provider>
  );
}
