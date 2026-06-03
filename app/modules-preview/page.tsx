"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ModuleBrief, ModuleBriefEditor } from "@/components/modules/ModuleBrief";
import { ModuleRoadmap, ModuleRoadmapEditor } from "@/components/modules/ModuleRoadmap";
import { ModuleChecklist, ModuleChecklistEditor } from "@/components/modules/ModuleChecklist";
import { ModuleBring, ModuleBringEditor } from "@/components/modules/ModuleBring";
import { ModuleKV, ModuleKVEditor } from "@/components/modules/ModuleKV";
import { ModuleMoodboard, ModuleMoodboardEditor } from "@/components/modules/ModuleMoodboard";
import { ModuleSetlist, ModuleSetlistEditor } from "@/components/modules/ModuleSetlist";
import { ModuleReflist, ModuleReflistEditor } from "@/components/modules/ModuleReflist";
import { ModulePicker } from "@/components/modules/ModulePicker";
import type { CardModule } from "@/lib/types";

/**
 * /modules-preview — throwaway sandbox. Every module type is rendered
 * side-by-side, cycling through its three lifecycle states (empty,
 * display, edit) so the look + interaction can be felt without
 * touching real cards. Goes away once the design + behavior is signed
 * off and the modules are integrated into PostDetail.
 */
type Mode = "display" | "edit" | "empty";

const SEED = {
  brief: "Cocktails by the Seine — a chance to see friends I haven't in weeks.",
  roadmap: [
    "Lock the riverbank spot",
    "Cast the small crew",
    "Bring the kit",
    "Run the night",
    "Share the photos",
  ],
  checklist: [
    "Confirm the host",
    "Send the invites",
    "Pick a backup spot",
    "Sort out drinks",
    "Build the playlist",
  ],
  bring: ["Wine", "Records", "Snacks", "Camera", "Stories", "Cash"],
  kv: [
    { key: "LOOKS", value: "Wong Kar-wai, neon haze, rain on glass" },
    { key: "BRING", value: "One garment that isn't yours" },
    { key: "DRESS-CODE", value: "Quiet luxury, low key" },
  ],
  moodboard: [
    { url: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=600&auto=format&fit=crop", caption: "Seine, golden hour" },
    { url: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600&auto=format&fit=crop", caption: "Glassware close-up" },
    { url: "https://images.unsplash.com/photo-1485395037613-e83d5c1f5290?w=600&auto=format&fit=crop", caption: "Quay reflections" },
    { url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop", caption: "Night bridge" },
  ],
  setlist: [
    { time: "18:30", title: "Apéro on the quay" },
    { time: "19:30", title: "Group walk to the bridge" },
    { time: "20:00", title: "Dinner at the bistro" },
    { time: "22:00", title: "Late drinks at La Marine" },
  ],
  reflist: [
    { url: "https://www.are.na/leon-boulliung/cocktails-by-the-seine", caption: "Are.na board" },
    { url: "https://www.parismusees.paris.fr/", caption: "Paris museum agenda" },
    { url: "https://www.openstreetmap.org/relation/7444", caption: "OSM Paris boundary" },
  ],
};

export default function ModulesPreviewPage() {
  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain animate-fadeIn">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-16 space-y-12 sm:space-y-16">
          <div className="space-y-3 border-b border-rule pb-8">
            <div className="mono text-[10px] tracking-widest opacity-60">SANDBOX</div>
            <h1 className="editorial font-black text-[40px] sm:text-[56px] leading-[0.95]">
              Modules preview.
            </h1>
            <p className="mono text-[12px] opacity-70 leading-relaxed max-w-xl">
              Five modules, side-by-side. Each cycles through its empty,
              display and edit states. Nothing here saves to a real card —
              this page goes away once we agree on the look and integrate.
            </p>
            <Link href="/" className="mono text-[11px] tracking-widest hover:underline inline-block">
              ← BACK TO PARIS
            </Link>
          </div>

          <PickerSection />
          <BriefSection />
          <RoadmapSection />
          <ChecklistSection />
          <BringSection />
          <KVSection />
          <MoodboardSection />
          <SetlistSection />
          <ReflistSection />
        </div>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Manual switcher demo — what the owner will see when they tap
// "↻ switch type" on an existing module, or "+ add a module yourself"
// when their thing has no module yet.
// ────────────────────────────────────────────────────────────────────────────
function PickerSection() {
  const [current, setCurrent] = useState<CardModule["type"]>("brief");
  return (
    <section className="space-y-4">
      <div className="border-b border-rule pb-3">
        <div className="mono text-[10px] tracking-widest opacity-60">MANUAL SWITCHER</div>
        <h2 className="editorial font-black text-[26px] sm:text-[32px] leading-none mt-1">
          Pick a module yourself.
        </h2>
        <p className="mono text-[11px] opacity-70 mt-1.5 max-w-lg">
          The owner can always choose the structure that fits — independent
          of (or after rejecting) what the AI suggests. Clicking an option
          here just highlights it; in the real integration it will open
          the matching editor.
        </p>
      </div>
      <div className="border border-rule rounded-2xl bg-paper p-4 sm:p-6 shadow-sm">
        <ModulePicker current={current} onPick={setCurrent} />
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Layout helpers
// ────────────────────────────────────────────────────────────────────────────

function ModuleSection({
  name,
  blurb,
  mode,
  onMode,
  children,
}: {
  name: string;
  blurb: string;
  mode: Mode;
  onMode: (m: Mode) => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap border-b border-rule pb-3">
        <div>
          <div className="mono text-[10px] tracking-widest opacity-60">MODULE</div>
          <h2 className="editorial font-black text-[26px] sm:text-[32px] leading-none mt-1">{name}</h2>
          <p className="mono text-[11px] opacity-70 mt-1.5 max-w-lg">{blurb}</p>
        </div>
        <div className="inline-flex rounded-full border border-rule-strong overflow-hidden mono text-[10px] tracking-widest shrink-0">
          {(["empty", "display", "edit"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              className={`px-3 py-1 ${mode === m ? "bg-ink text-paper" : "hover:bg-ink/5"}`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="border border-rule rounded-2xl bg-paper p-4 sm:p-6 shadow-sm">
        {children}
      </div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 underline underline-offset-2">
        ✦ Help shape this
      </button>
      <button className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100">
        + write {label} yourself
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Module sections
// ────────────────────────────────────────────────────────────────────────────

function BriefSection() {
  const [mode, setMode] = useState<Mode>("display");
  return (
    <ModuleSection
      name="Brief"
      blurb="A single-sentence mission for the thing. The anchor everyone reads first."
      mode={mode}
      onMode={setMode}
    >
      {mode === "empty" && <EmptyState label="one" />}
      {mode === "display" && <ModuleBrief text={SEED.brief} />}
      {mode === "edit" && (
        <ModuleBriefEditor
          initial={SEED.brief}
          onSave={() => setMode("display")}
          onCancel={() => setMode("display")}
          onRemove={() => setMode("empty")}
        />
      )}
    </ModuleSection>
  );
}

function RoadmapSection() {
  const [mode, setMode] = useState<Mode>("display");
  return (
    <ModuleSection
      name="Roadmap"
      blurb="3 – 5 chronological steps, in order. The shape of the plan."
      mode={mode}
      onMode={setMode}
    >
      {mode === "empty" && <EmptyState label="steps" />}
      {mode === "display" && <ModuleRoadmap steps={SEED.roadmap} />}
      {mode === "edit" && (
        <ModuleRoadmapEditor
          initial={SEED.roadmap}
          onSave={() => setMode("display")}
          onCancel={() => setMode("display")}
          onRemove={() => setMode("empty")}
        />
      )}
    </ModuleSection>
  );
}

function ChecklistSection() {
  const [mode, setMode] = useState<Mode>("display");
  return (
    <ModuleSection
      name="Checklist"
      blurb="An unordered punch list. What still needs doing — without forcing a sequence."
      mode={mode}
      onMode={setMode}
    >
      {mode === "empty" && <EmptyState label="a list" />}
      {mode === "display" && <ModuleChecklist items={SEED.checklist} />}
      {mode === "edit" && (
        <ModuleChecklistEditor
          initial={SEED.checklist}
          onSave={() => setMode("display")}
          onCancel={() => setMode("display")}
          onRemove={() => setMode("empty")}
        />
      )}
    </ModuleSection>
  );
}

function BringSection() {
  const [mode, setMode] = useState<Mode>("display");
  return (
    <ModuleSection
      name="Bring"
      blurb="A casual cloud of things participants bring along. No order, no checkbox."
      mode={mode}
      onMode={setMode}
    >
      {mode === "empty" && <EmptyState label="a bring-list" />}
      {mode === "display" && <ModuleBring items={SEED.bring} />}
      {mode === "edit" && (
        <ModuleBringEditor
          initial={SEED.bring}
          onSave={() => setMode("display")}
          onCancel={() => setMode("display")}
          onRemove={() => setMode("empty")}
        />
      )}
    </ModuleSection>
  );
}

function KVSection() {
  const [mode, setMode] = useState<Mode>("display");
  return (
    <ModuleSection
      name="Details (KV)"
      blurb="A short tech-spec sidebar — LOOKS, BRING, STACK — that fits the vibe."
      mode={mode}
      onMode={setMode}
    >
      {mode === "empty" && <EmptyState label="details" />}
      {mode === "display" && <ModuleKV entries={SEED.kv} />}
      {mode === "edit" && (
        <ModuleKVEditor
          initial={SEED.kv}
          onSave={() => setMode("display")}
          onCancel={() => setMode("display")}
          onRemove={() => setMode("empty")}
        />
      )}
    </ModuleSection>
  );
}

function MoodboardSection() {
  const [mode, setMode] = useState<Mode>("display");
  return (
    <ModuleSection
      name="Moodboard"
      blurb="A visual board of reference images. Pinterest / Are.na URLs. No upload yet."
      mode={mode}
      onMode={setMode}
    >
      {mode === "empty" && <EmptyState label="refs" />}
      {mode === "display" && <ModuleMoodboard refs={SEED.moodboard} />}
      {mode === "edit" && (
        <ModuleMoodboardEditor
          initial={SEED.moodboard}
          onSave={() => setMode("display")}
          onCancel={() => setMode("display")}
          onRemove={() => setMode("empty")}
        />
      )}
    </ModuleSection>
  );
}

function SetlistSection() {
  const [mode, setMode] = useState<Mode>("display");
  return (
    <ModuleSection
      name="Setlist"
      blurb="The programme during the event. Time-stamps optional. Distinct from roadmap (preparation)."
      mode={mode}
      onMode={setMode}
    >
      {mode === "empty" && <EmptyState label="a setlist" />}
      {mode === "display" && <ModuleSetlist items={SEED.setlist} />}
      {mode === "edit" && (
        <ModuleSetlistEditor
          initial={SEED.setlist}
          onSave={() => setMode("display")}
          onCancel={() => setMode("display")}
          onRemove={() => setMode("empty")}
        />
      )}
    </ModuleSection>
  );
}

function ReflistSection() {
  const [mode, setMode] = useState<Mode>("display");
  return (
    <ModuleSection
      name="Reflist"
      blurb="External links — inspirations, sources, agendas. Optional caption per link."
      mode={mode}
      onMode={setMode}
    >
      {mode === "empty" && <EmptyState label="refs" />}
      {mode === "display" && <ModuleReflist items={SEED.reflist} />}
      {mode === "edit" && (
        <ModuleReflistEditor
          initial={SEED.reflist}
          onSave={() => setMode("display")}
          onCancel={() => setMode("display")}
          onRemove={() => setMode("empty")}
        />
      )}
    </ModuleSection>
  );
}
