"use client";

import { useState } from "react";
import Link from "next/link";
import { ModuleRenderer } from "@/components/modules";
import { MODULE_META } from "@/lib/modules";
import { ALL_VIBES, type Module, type Vibe } from "@/lib/types";

/**
 * Showroom — a static playground for the 19 module types and 6
 * vibes. Defaults are anchored to a fixed test prompt so iteration
 * is comparable from session to session.
 *
 * Nothing here persists. State writes go to a stub endpoint that
 * accepts and discards. The showroom is for SEEING and FEELING.
 */

const TEST_PROMPT = "I need help with videography around june to august for my novel";

/**
 * One sensible default per module type, anchored to the test prompt.
 * The AI in production would generate these; here they're hand-picked
 * so the showroom is stable and comparable.
 */
const DEFAULTS: Module[] = [
  {
    type: "headline",
    label: "Headline",
    title: "Videography for my novel",
    subtitle: "June through August",
  },
  {
    type: "synthesis",
    label: "Synthesis",
    text: "You're working on a novel and need help with videography in a three-month window. The key choices are format (social vs. trailer vs. long-form), tone (matches the book's voice), and who you can actually pull in for two or three shoot days.",
  },
  {
    type: "tags",
    label: "Topics",
    tags: ["novel", "videography", "summer", "promo"],
  },
  {
    type: "notes",
    label: "Context",
    text: "The video is meant to support the novel's release, not replace it. Tone and pacing should mirror the book's voice. Likely a mix of short clips for social and one anchor piece for the launch.",
  },
  {
    type: "open_question",
    label: "The pivotal question",
    prompt: "What is the video FOR — a social promo, behind-the-scenes documentation, or a launch piece?",
  },
  {
    type: "poll",
    label: "Format direction",
    question: "Which format best fits the novel?",
    options: ["30-second social clip", "2-minute trailer", "Long-form documentary"],
  },
  {
    type: "checklist",
    label: "What needs doing",
    items: [
      { text: "Find a videographer who reads" },
      { text: "Define visual style + references" },
      { text: "Pick two filming days" },
      { text: "Prep location and gear list" },
    ],
  },
  {
    type: "help_slots",
    label: "Who you'd need on the project",
    slots: [
      { label: "Videographer" },
      { label: "Editor" },
      { label: "Location scout" },
      { label: "Producer / project lead" },
    ],
  },
  {
    type: "stages",
    label: "How it unfolds",
    stages: ["Briefing", "Pre-production", "Shoot", "Edit", "Launch"],
    current: 0,
  },
  {
    type: "number_block",
    label: "Window",
    value: "3 mo.",
    caption: "June through August",
  },
  {
    type: "icon",
    label: "Visual anchor",
    iconify: "lucide:video",
    size: 64,
  },
  {
    type: "palette",
    label: "Mood",
    hue: "indigo",
    steps: [2, 4, 6, 8, 10],
  },
  {
    type: "map",
    label: "Filming area",
    center: [13.4050, 52.5200], // Berlin as a placeholder
    zoom: 11,
  },
  {
    type: "time",
    label: "First filming day",
    mode: "countdown",
    date: "2025-06-15",
  },
  {
    type: "knowledge",
    label: "Reference",
    topic: "Book trailer",
    source: "wikipedia",
    show: ["summary", "thumb"],
    attribution: {
      name: "Wikipedia",
      url: "https://en.wikipedia.org",
      license: "CC-BY-SA 4.0",
    },
  },
  {
    type: "framework",
    label: "Structure",
    kind: "one_pager",
    prefill: {
      problem: "A novel needs a video that does it justice without competing with it.",
      proposal: "A 3-month effort: pre-pro in June, shoot in July, edit and launch in August.",
      success: "The video lands the book's voice; readers come from the right places.",
    },
  },
  {
    type: "typography",
    label: "Typography",
    heading: "Source Serif 4",
    body: "Inter",
  },
  {
    type: "formula",
    label: "Math example",
    latex: "e^{i\\pi} + 1 = 0",
    display: "block",
  },
  {
    type: "chart",
    label: "Numeric example",
    chartType: "bar",
    data: [
      { x: "June",   y: 8 },
      { x: "July",   y: 14 },
      { x: "August", y: 10 },
    ],
    xLabel: "Month",
    yLabel: "Shoot days",
  },
  {
    type: "image",
    label: "Wikimedia example",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Old_books_by_bionicteaching.jpg/640px-Old_books_by_bionicteaching.jpg",
    alt: "An old book",
    attribution: {
      name: "Wikimedia Commons (Alan Levine)",
      url: "https://commons.wikimedia.org/wiki/File:Old_books_by_bionicteaching.jpg",
      license: "CC-BY 2.0",
    },
  },
];

const TIER_LABELS: Record<string, string> = {
  headline:      "A · framing",
  synthesis:     "A · framing",
  tags:          "A · framing",
  notes:         "A · framing",
  open_question: "A · reactive",
  poll:          "A · reactive",
  checklist:     "A · reactive",
  help_slots:    "A · reactive",
  stages:        "A · reactive",
  number_block:  "A · framing",
  icon:          "B · iconify",
  palette:       "B · open-props",
  map:           "B · openstreetmap",
  time:          "B · intl",
  knowledge:     "B · wikipedia",
  framework:     "C · static",
  typography:    "B · google fonts",
  formula:       "B · katex",
  chart:         "B · plot",
  image:         "B · wikimedia",
};

export default function ShowroomPage() {
  const [vibe, setVibe] = useState<Vibe>("minimal");

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Top bar — sticky, holds the vibe selector and the prompt context. */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-black/10">
        <div className="max-w-5xl mx-auto px-5 py-4 space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="mono text-[10px] tracking-widest opacity-50">SHOWROOM</div>
              <h1 className="font-black text-[20px] sm:text-[24px] leading-none mt-0.5">
                All modules × all vibes
              </h1>
            </div>
            <Link href="/" className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100 shrink-0">
              ← back
            </Link>
          </div>

          <div className="mono text-[10px] tracking-widest opacity-60 italic">
            test prompt: &ldquo;{TEST_PROMPT}&rdquo;
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {ALL_VIBES.map((v) => {
              const picked = vibe === v;
              return (
                <button
                  key={v}
                  onClick={() => setVibe(v)}
                  className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    border: "1px solid",
                    borderColor: picked ? "#000" : "#0001",
                    background: picked ? "#000" : "transparent",
                    color: picked ? "#fff" : "#000",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vibe surface — every module renders inside this. */}
      <div className={`vibe-root vibe-${vibe}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-10">
          {DEFAULTS.map((m, i) => (
            <article key={i} className="space-y-2">
              <header className="flex items-baseline justify-between gap-3 pb-1 border-b" style={{ borderColor: "var(--v-rule)" }}>
                <span className="mono text-[10px] tracking-widest uppercase" style={{ color: "var(--v-fg)" }}>
                  {m.type.replace("_", " ")}
                </span>
                <span className="mono text-[9px] tracking-widest" style={{ color: "var(--v-muted)" }}>
                  {TIER_LABELS[m.type]} · {MODULE_META[m.type].dataSource ?? "no source"}
                </span>
              </header>
              <ModuleRenderer
                spaceId="showroom"
                module={m}
                moduleIndex={i}
                state={[]}
                onChanged={() => {}}
              />
            </article>
          ))}

          <footer className="pt-10 text-center" style={{ borderTop: "1px solid var(--v-rule)" }}>
            <p className="mono text-[10px] tracking-widest" style={{ color: "var(--v-muted)" }}>
              Read-only playground. No state persists.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
