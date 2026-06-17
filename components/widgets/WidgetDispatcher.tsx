"use client";

import dynamic from "next/dynamic";
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
import { ShotListRenderer } from "./ShotListRenderer";
import { PartsListRenderer } from "./PartsListRenderer";
import { ChecklistRenderer } from "./ChecklistRenderer";
import { PollRenderer } from "./PollRenderer";
import { CrewRenderer } from "./CrewRenderer";
import { WorkPackagesRenderer } from "./WorkPackagesRenderer";
import { DeliverablesRenderer } from "./DeliverablesRenderer";
import { ApprovalsRenderer } from "./ApprovalsRenderer";
import { QaRenderer } from "./QaRenderer";
import { DiscussionRenderer } from "./DiscussionRenderer";

// Phase 3
import { WikipediaRenderer } from "./WikipediaRenderer";
import { DateRenderer } from "./DateRenderer";
import { AppointmentRenderer } from "./AppointmentRenderer";
import { AppointmentsRenderer } from "./AppointmentsRenderer";

// Phase 4
import { PhasesRenderer } from "./PhasesRenderer";

// Phase 6
const IconRenderer = dynamic(() => import("./IconRenderer").then((mod) => mod.IconRenderer), { loading: () => <LoadingPlaceholder type="icon" /> });
const LocationSingleRenderer = dynamic(() => import("./LocationSingleRenderer").then((mod) => mod.LocationSingleRenderer), { loading: () => <LoadingPlaceholder type="location_single" /> });
const LocationsMultiRenderer = dynamic(() => import("./LocationsMultiRenderer").then((mod) => mod.LocationsMultiRenderer), { loading: () => <LoadingPlaceholder type="locations_multi" /> });
const LocationSuggestionsRenderer = dynamic(() => import("./LocationSuggestionsRenderer").then((mod) => mod.LocationSuggestionsRenderer), { loading: () => <LoadingPlaceholder type="location_suggestions" /> });
const RouteRenderer = dynamic(() => import("./RouteRenderer").then((mod) => mod.RouteRenderer), { loading: () => <LoadingPlaceholder type="route" /> });
const AttachmentsRenderer = dynamic(() => import("./AttachmentsRenderer").then((mod) => mod.AttachmentsRenderer), { loading: () => <LoadingPlaceholder type="attachments" /> });
const ImagesRenderer = dynamic(() => import("./ImagesRenderer").then((mod) => mod.ImagesRenderer), { loading: () => <LoadingPlaceholder type="images" /> });
const MoodboardRenderer = dynamic(() => import("./MoodboardRenderer").then((mod) => mod.MoodboardRenderer), { loading: () => <LoadingPlaceholder type="moodboard" /> });
const AudioRenderer = dynamic(() => import("./AudioRenderer").then((mod) => mod.AudioRenderer), { loading: () => <LoadingPlaceholder type="audio" /> });
const GifRenderer = dynamic(() => import("./GifRenderer").then((mod) => mod.GifRenderer), { loading: () => <LoadingPlaceholder type="gif" /> });
const SketchRenderer = dynamic(() => import("./SketchRenderer").then((mod) => mod.SketchRenderer), { loading: () => <LoadingPlaceholder type="sketch" /> });

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
    case "shot_list":
      return <ShotListRenderer module={m} index={index} state={s} />;
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
    case "deliverables":
      return <DeliverablesRenderer module={m} index={index} state={s} />;
    case "approvals":
      return <ApprovalsRenderer module={m} index={index} state={s} />;
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

    // Phase 4
    case "location_single":
      return <LocationSingleRenderer module={m} index={index} />;
    case "locations_multi":
      return <LocationsMultiRenderer module={m} index={index} />;
    case "location_suggestions":
      return <LocationSuggestionsRenderer module={m} index={index} state={s} />;
    case "route":
      return <RouteRenderer module={m} index={index} />;

    // Phase 5
    case "phases":
      return <PhasesRenderer module={m} index={index} />;

    // Phase 6
    case "attachments":
      return <AttachmentsRenderer module={m} index={index} state={s} />;
    case "images":
      return <ImagesRenderer module={m} index={index} state={s} />;
    case "moodboard":
      return <MoodboardRenderer module={m} index={index} state={s} />;
    case "audio":
      return <AudioRenderer module={m} index={index} state={s} />;

    // Phase 7
    case "gif":
      return <GifRenderer module={m} index={index} />;

    // Phase 8
    case "sketch":
      return <SketchRenderer module={m} index={index} state={s} />;

    default:
      // Exhaustive match — all 33 widget types are handled above.
      // This branch is a forward-compat safety net for new types added
      // before a renderer is built.
      return <PendingPlaceholder type={(m as { type: string }).type} />;
  }
}

function PendingPlaceholder({ type }: { type: string }) {
  const ctx = useWidgetContext();
  return (
    <div
      className="rounded-[var(--v-radius)] p-4 h-full min-h-[120px] flex flex-col gap-2"
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

function LoadingPlaceholder({ type }: { type: string }) {
  return <PendingPlaceholder type={type} />;
}
