"use client";

import type { Module } from "@/lib/types";
import { useWidgetContext } from "@/lib/widgetContext";
import { label } from "@/lib/labels";
import { HeadingRenderer } from "./HeadingRenderer";
import { RichTextRenderer } from "./RichTextRenderer";
import { TagsRenderer } from "./TagsRenderer";

/**
 * Single entry point for rendering a widget. Each Phase adds renderers
 * here; everything not yet implemented falls through to the
 * placeholder so the space stays renderable while we iterate.
 */
export function WidgetDispatcher({
  module: m,
  index,
}: {
  module: Module;
  index: number;
}) {
  switch (m.type) {
    case "heading":
      return <HeadingRenderer module={m} index={index} />;
    case "rich_text":
      return <RichTextRenderer module={m} index={index} />;
    case "tags":
      return <TagsRenderer module={m} index={index} />;
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
