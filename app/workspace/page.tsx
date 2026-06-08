"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ModuleRenderer } from "@/components/modules";
import { ALL_MODULE_TYPES, ALL_VIBES, type Module, type ModuleType, type Vibe } from "@/lib/types";
import { bodyContainer, bodyItem, heroIn, synthesisIn } from "@/lib/anim";

/**
 * Workspace prototype.
 *
 * A grid-based exploration of how a published space could look once
 * widgets are no longer a vertical card-stack but a 12-column raster
 * where each widget chooses its own column-span and row-span.
 *
 * Three regions, top to bottom:
 *
 *   HERO (fixed)
 *     Headline — full width
 *     Synthesis — narrower, sits below the headline
 *
 *   GRID (flexible)
 *     12 responsive columns. Each widget specifies its span. Owner
 *     can resize (1/2/3/4 of the width) and reorder via the edit
 *     mode. Drag-to-position comes in the next iteration.
 *
 *   ADD-BAR (sticky bottom)
 *     Owner can append a new widget; the picker covers every type
 *     in the registry.
 *
 * Content anchored to the videography test prompt so iteration is
 * comparable to the showroom.
 */

interface WidgetLayout {
  id: string;
  module: Module;
  /** 1–4. 1 = quarter, 2 = half, 3 = three-quarters, 4 = full width. */
  span: 1 | 2 | 3 | 4;
  /** When true: bigger height, used for map / chart / framework. */
  tall?: boolean;
}

const INITIAL_LAYOUT: WidgetLayout[] = [
  {
    id: "icon",
    span: 1,
    module: {
      type: "icon",
      label: "Visual anchor",
      iconify: "lucide:video",
      size: 56,
    },
  },
  {
    id: "tags",
    span: 1,
    module: {
      type: "tags",
      label: "Topics",
      tags: ["novel", "videography", "summer", "promo"],
    },
  },
  {
    id: "number",
    span: 1,
    module: {
      type: "number_block",
      label: "Window",
      value: "3 mo.",
      caption: "June → August",
    },
  },
  {
    id: "time",
    span: 1,
    module: {
      type: "time",
      label: "Erstes Drehfenster",
      mode: "countdown",
      date: "2025-06-15",
    },
  },
  {
    id: "question",
    span: 2,
    module: {
      type: "open_question",
      label: "Womit hier alles steht und fällt",
      prompt: "What is the video FOR — a social promo, behind-the-scenes documentation, or a launch piece?",
    },
  },
  {
    id: "poll",
    span: 2,
    module: {
      type: "poll",
      label: "Format-Richtung",
      question: "Which format best fits the novel?",
      options: ["30-second social clip", "2-minute trailer", "Long-form documentary"],
    },
  },
  {
    id: "help",
    span: 2,
    module: {
      type: "help_slots",
      label: "Wer was übernehmen müsste",
      slots: [
        { label: "Videographer" },
        { label: "Editor" },
        { label: "Location scout" },
        { label: "Producer / project lead" },
      ],
    },
  },
  {
    id: "stages",
    span: 2,
    module: {
      type: "stages",
      label: "Wie sich das entfaltet",
      stages: ["Briefing", "Pre-production", "Shoot", "Edit", "Launch"],
      current: 0,
    },
  },
  {
    id: "checklist",
    span: 2,
    module: {
      type: "checklist",
      label: "Was als nächstes zu tun ist",
      items: [
        { text: "Find a videographer who reads" },
        { text: "Define visual style + references" },
        { text: "Pick two filming days" },
        { text: "Prep location and gear list" },
      ],
    },
  },
  {
    id: "knowledge",
    span: 2,
    module: {
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
  },
  {
    id: "notes",
    span: 4,
    module: {
      type: "notes",
      label: "Context",
      text: "The video is meant to support the novel's release, not replace it. Tone and pacing should mirror the book's voice. Likely a mix of short clips for social and one anchor piece for the launch.",
    },
  },
];

const HERO: { headline: Module; synthesis: Module } = {
  headline: {
    type: "headline",
    label: "Headline",
    title: "Videography for my novel",
    subtitle: "June through August",
  },
  synthesis: {
    type: "synthesis",
    label: "Synthesis",
    text:
      "You're working on a novel and need help with videography in a three-month window. The key choices are format (social vs. trailer vs. long-form), tone (matches the book's voice), and who you can actually pull in for two or three shoot days.",
  },
};

const SPAN_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "col-span-12 sm:col-span-6 lg:col-span-3",
  2: "col-span-12 sm:col-span-6 lg:col-span-6",
  3: "col-span-12 lg:col-span-9",
  4: "col-span-12",
};

const SPAN_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: "¼",
  2: "½",
  3: "¾",
  4: "1/1",
};

export default function WorkspacePage() {
  const [vibe, setVibe] = useState<Vibe>("minimal");
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<WidgetLayout[]>(INITIAL_LAYOUT);
  const [pickerOpen, setPickerOpen] = useState(false);

  const moveWidget = (id: string, dir: -1 | 1) => {
    setLayout((current) => {
      const idx = current.findIndex((w) => w.id === id);
      if (idx < 0) return current;
      const next = idx + dir;
      if (next < 0 || next >= current.length) return current;
      const copy = [...current];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const removeWidget = (id: string) => {
    setLayout((current) => current.filter((w) => w.id !== id));
  };

  const setSpan = (id: string, span: 1 | 2 | 3 | 4) => {
    setLayout((current) => current.map((w) => (w.id === id ? { ...w, span } : w)));
  };

  const addWidget = (type: ModuleType) => {
    const newWidget = createDefaultWidget(type);
    if (!newWidget) return;
    setLayout((current) => [...current, newWidget]);
    setPickerOpen(false);
  };

  const availableToAdd = useMemo(() => {
    const used = new Set(layout.map((w) => w.id));
    return ALL_MODULE_TYPES
      .filter((t) => t !== "headline" && t !== "synthesis")
      .filter((t) => !used.has(t));
  }, [layout]);

  return (
    <div className={`vibe-root vibe-${vibe} min-h-screen`}>
      {/* Top bar — sticky */}
      <div className="sticky top-0 z-30" style={{ background: "var(--v-bg)", borderBottom: "1px solid var(--v-rule)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/" className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100">
              ←
            </Link>
            <span className="mono text-[10px] tracking-widest opacity-60">WORKSPACE</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {ALL_VIBES.map((v) => {
              const picked = vibe === v;
              return (
                <button
                  key={v}
                  onClick={() => setVibe(v)}
                  className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    border: "1px solid",
                    borderColor: picked ? "var(--v-fg)" : "var(--v-rule)",
                    background: picked ? "var(--v-fg)" : "transparent",
                    color: picked ? "var(--v-bg)" : "var(--v-fg)",
                  }}
                >
                  {v}
                </button>
              );
            })}
            <button
              onClick={() => setEditMode((m) => !m)}
              className="mono text-[10px] tracking-widest px-3 py-1 rounded-full"
              style={{
                border: "1px solid var(--v-fg)",
                background: editMode ? "var(--v-fg)" : "transparent",
                color: editMode ? "var(--v-bg)" : "var(--v-fg)",
                marginLeft: "8px",
              }}
            >
              {editMode ? "done" : "edit layout"}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10">
        {/* HERO — fixed, always at the top, never editable here. */}
        <motion.section
          initial="hidden"
          animate="show"
          variants={heroIn}
          className="space-y-3"
        >
          <ModuleRenderer
            spaceId="workspace"
            module={HERO.headline}
            moduleIndex={-1}
            state={[]}
            onChanged={() => {}}
          />
          <motion.div variants={synthesisIn}>
            <ModuleRenderer
              spaceId="workspace"
              module={HERO.synthesis}
              moduleIndex={-1}
              state={[]}
              onChanged={() => {}}
            />
          </motion.div>
        </motion.section>

        {/* GRID — flexible. */}
        <motion.section
          initial="hidden"
          animate="show"
          variants={bodyContainer}
          className="grid grid-cols-12 gap-3 sm:gap-4"
        >
          <AnimatePresence initial={false}>
            {layout.map((w, idx) => (
              <motion.div
                key={w.id}
                layout
                variants={bodyItem}
                initial={editMode ? false : "hidden"}
                animate="show"
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                transition={{ layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
                className={`relative ${SPAN_CLASS[w.span]} ${w.tall ? "row-span-2" : ""}`}
              >
                <div
                  className="h-full"
                  style={{
                    outline: editMode ? "1px dashed var(--v-rule-strong, var(--v-rule))" : "none",
                    outlineOffset: editMode ? "4px" : "0",
                    borderRadius: "6px",
                    transition: "outline 0.2s",
                  }}
                >
                  <ModuleRenderer
                    spaceId="workspace"
                    module={w.module}
                    moduleIndex={idx}
                    state={[]}
                    onChanged={() => {}}
                  />
                </div>

                {/* Edit-mode controls — float in the top-right of the widget. */}
                <AnimatePresence>
                  {editMode && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute -top-2 -right-2 flex items-center gap-1 z-10"
                    >
                      <SpanPicker span={w.span} onChange={(s) => setSpan(w.id, s)} />
                      <button
                        onClick={() => moveWidget(w.id, -1)}
                        title="Move up"
                        className="mono text-[10px] w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: "var(--v-fg)", color: "var(--v-bg)" }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveWidget(w.id, 1)}
                        title="Move down"
                        className="mono text-[10px] w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: "var(--v-fg)", color: "var(--v-bg)" }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeWidget(w.id)}
                        title="Remove"
                        className="mono text-[10px] w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: "transparent", color: "var(--v-fg)", border: "1px solid var(--v-rule)" }}
                      >
                        ×
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.section>

        {/* ADD-BAR. */}
        <section className="pt-2">
          <div className="flex items-center justify-center">
            <button
              onClick={() => setPickerOpen(true)}
              disabled={availableToAdd.length === 0}
              className="mono text-[11px] tracking-widest px-5 py-2.5 rounded-full transition-colors disabled:opacity-30"
              style={{
                border: "1px dashed var(--v-rule-strong, var(--v-rule))",
                color: "var(--v-fg)",
                background: "transparent",
              }}
            >
              + add widget
            </button>
          </div>
        </section>

        <footer className="pt-6 flex items-center justify-between" style={{ borderTop: "1px solid var(--v-rule)" }}>
          <span className="mono text-[10px] tracking-widest opacity-50">
            grid prototype · videography test prompt
          </span>
          <span className="mono text-[9px] tracking-widest opacity-30">CREATOR</span>
        </footer>
      </main>

      {/* Widget picker — opens from the add button. */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setPickerOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-2xl w-full p-6 rounded-2xl"
              style={{ background: "var(--v-bg)", color: "var(--v-fg)", border: "1px solid var(--v-rule)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mono text-[10px] tracking-widest opacity-60 mb-3">ADD WIDGET</div>
              <h2 className="vibe-heading font-black text-[24px] leading-snug mb-5">
                Welche Art von Widget?
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableToAdd.map((t) => (
                  <button
                    key={t}
                    onClick={() => addWidget(t)}
                    className="text-left p-3 rounded-md transition-colors"
                    style={{
                      border: "1px solid var(--v-rule)",
                      background: "transparent",
                    }}
                  >
                    <div className="mono text-[10px] tracking-widest opacity-80">
                      {t.replace("_", " ")}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setPickerOpen(false)}
                  className="mono text-[10px] tracking-widest opacity-60 hover:opacity-100"
                >
                  abbrechen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   Small UI bits
   ============================================================ */

function SpanPicker({
  span,
  onChange,
}: {
  span: 1 | 2 | 3 | 4;
  onChange: (s: 1 | 2 | 3 | 4) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--v-fg)" }}>
      {([1, 2, 3, 4] as const).map((s) => {
        const picked = s === span;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className="mono text-[9px] tabular-nums px-1.5 py-0.5 rounded-full"
            style={{
              background: picked ? "var(--v-bg)" : "transparent",
              color: picked ? "var(--v-fg)" : "var(--v-bg)",
            }}
            title={`Span ${SPAN_NAMES[s]}`}
          >
            {SPAN_NAMES[s]}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Defaults for newly-added widgets
   ============================================================ */

function createDefaultWidget(type: ModuleType): WidgetLayout | null {
  const id = `${type}-${Math.random().toString(36).slice(2, 7)}`;
  switch (type) {
    case "tags":
      return { id, span: 1, module: { type, label: "Tags", tags: ["new", "tag"] } };
    case "notes":
      return { id, span: 4, module: { type, label: "Notes", text: "Write here…" } };
    case "open_question":
      return { id, span: 2, module: { type, label: "Open question", prompt: "What's the question?" } };
    case "poll":
      return { id, span: 2, module: { type, label: "Poll", question: "Which one?", options: ["A", "B"] } };
    case "checklist":
      return { id, span: 2, module: { type, label: "Checklist", items: [{ text: "Item 1" }, { text: "Item 2" }] } };
    case "help_slots":
      return { id, span: 2, module: { type, label: "Help slots", slots: [{ label: "Slot 1" }, { label: "Slot 2" }] } };
    case "stages":
      return { id, span: 2, module: { type, label: "Stages", stages: ["A", "B", "C"], current: 0 } };
    case "number_block":
      return { id, span: 1, module: { type, label: "Number", value: "42", caption: "caption" } };
    case "icon":
      return { id, span: 1, module: { type, label: "Icon", iconify: "lucide:sparkles", size: 56 } };
    case "palette":
      return { id, span: 1, module: { type, label: "Palette", hue: "blue", steps: [3, 6, 9] } };
    case "map":
      return { id, span: 2, module: { type, label: "Map", center: [2.35, 48.85], zoom: 11 } };
    case "time":
      return { id, span: 1, module: { type, label: "Time", mode: "date", date: "2025-12-31" } };
    case "knowledge":
      return {
        id,
        span: 2,
        module: {
          type,
          label: "Reference",
          topic: "Wikipedia",
          source: "wikipedia",
          show: ["summary"],
          attribution: { name: "Wikipedia", url: "https://en.wikipedia.org", license: "CC-BY-SA 4.0" },
        },
      };
    case "framework":
      return {
        id,
        span: 3,
        module: {
          type,
          label: "Framework",
          kind: "one_pager",
          prefill: { problem: "", proposal: "", success: "" },
        },
      };
    case "typography":
      return { id, span: 2, module: { type, label: "Typography", heading: "Inter", body: "Inter" } };
    case "formula":
      return { id, span: 1, module: { type, label: "Formula", latex: "a^2 + b^2 = c^2", display: "block" } };
    case "chart":
      return {
        id,
        span: 2,
        module: {
          type,
          label: "Chart",
          chartType: "bar",
          data: [
            { x: "A", y: 4 },
            { x: "B", y: 7 },
            { x: "C", y: 3 },
          ],
        },
      };
    case "image":
      return null; // skip — requires a real URL
    case "headline":
    case "synthesis":
      return null; // can't add a second hero element
  }
}
