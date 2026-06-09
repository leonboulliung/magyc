"use client";

import type { Module, ModuleStateEntry } from "@/lib/types";
import { useWidgetContext } from "@/lib/widgetContext";
import { label } from "@/lib/labels";

// Phase 1
import { HeadingRenderer } from "./HeadingRenderer";
import { RichTextRenderer } from "./RichTextRenderer";
import { TagsRenderer } from "./TagsRenderer";

// Phase 2
import { RangeRenderer } from "./RangeRenderer";
import { AiSummaryRenderer } from "./AiSummaryRenderer";
import { NotesRenderer } from "./NotesRenderer";
import { TableRenderer } from "./TableRenderer";
import { PartsListRenderer } from "./PartsListRenderer";
import { ChecklistRenderer } from "./ChecklistRenderer";
import { PollRenderer } from "./PollRenderer";
import { CrewRenderer } from "./CrewRenderer";
import { WorkPackagesRenderer } from "./WorkPackagesRenderer";
import { QaRenderer } from "./QaRenderer";
import { DiscussionRenderer } from "./DiscussionRenderer";

// Phase 3
import { WikipediaRenderer } from "./WikipediaRenderer";
import { IconRenderer } from "./IconRenderer";
import { DateRenderer } from "./DateRenderer";
import { AppointmentRenderer } from "./AppointmentRenderer";
import { AppointmentsRenderer } from "./AppointmentsRenderer";

/**
 * Single entry point for rendering a widget. Each Phase adds renderers
 * here; everything not yet implemented falls through to the
 * placeholder so the space stays renderable while we iterate.
 *
 * Stateful widgets (notes, checklist, poll, crew, work_packages, qa,
 * discussion, parts_list) receive their slice of module_state. The
 * SpaceView slices state per moduleIndex once and hands it down so
 * every renderer only sees its own actions.
 */
export function WidgetDispatcher({
  module: m,
  index,
  state,
}: {
  module: Module;
  index: number;
  state?: ModuleStateEntry[];
}) {
  const s = state ?? [];
  switch (m.type) {
    // Phase 1
    case "heading":
      return <HeadingRenderer module={m} index={index} />;
    case "rich_text":
      return <RichTextRenderer module={m} index={index} />;
    case "tags":
      return <TagsRenderer module={m} index={index} />;

    // Phase 2
    case "range":
      return <RangeRenderer module={m} index={index} />;
    case "ai_summary":
      return <AiSummaryRenderer module={m} index={index} />;
    case "notes":
      return <NotesRenderer module={m} index={index} state={s} />;
    case "table":
      return <TableRenderer module={m} index={index} />;
    case "parts_list":
      return <PartsListRenderer module={m} index={index} state={s} />;
    case "checklist":
      return <ChecklistRenderer module={m} index={index} state={s} />;
    case "poll":
      return <PollRenderer module={m} index={index} state={s} />;
    case "crew":
      return <CrewRenderer module={m} index={index} state={s} />;
    case "work_packages":
      return <WorkPackagesRenderer module={m} index={index} state={s} />;
    case "qa":
      return <QaRenderer module={m} index={index} state={s} />;
    case "discussion":
      return <DiscussionRenderer module={m} index={index} state={s} />;

    // Phase 3
    case "wikipedia":
      return <WikipediaRenderer module={m} index={index} />;
    case "icon":
      return <IconRenderer module={m} index={index} />;
    case "date":
      return <DateRenderer module={m} index={index} />;
    case "appointment":
      return <AppointmentRenderer module={m} index={index} />;
    case "appointments":
      return <AppointmentsRenderer module={m} index={index} />;

    default:
      return <PendingPlaceholder type={m.type} />;
  }
}

function PendingPlaceholder({ type }: { type: string }) {
  const ctx = useWidgetContext();
  return (
    <div
      className="rounded-md p-4 h-full min-h-[120px] flex flex-col gap-2"
      style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)" }}
    >
      <div className="mono text-[10px] tracking-widest" style={{ color: "var(--v-muted)" }}>
        {type.replace("_", " ")}
      </div>
      <div className="mono text-[10px] opacity-50" style={{ color: "var(--v-muted)" }}>
        {label(ctx.labels, "rendererPending")}
      </div>
    </div>
  );
}
