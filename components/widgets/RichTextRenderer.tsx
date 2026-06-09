"use client";

import { useEffect, useRef, useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { RichTextWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";

/**
 * Rich-text widget renderer.
 *
 *   Two editable surfaces:
 *     - microTitle: small mono uppercase label ("Kontext", "Idea", …)
 *     - text: the body prose
 *
 *   Both edit inline on click (owner only). Blur or Enter saves;
 *   Escape cancels. Placeholders shown when fields are empty.
 *
 *   The regenerate ↻ surfaces 3 alternative microTitle+text pairs.
 */
export function RichTextRenderer({
  module: m,
  index,
}: {
  module: RichTextWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [titleDraft, setTitleDraft] = useState(m.microTitle ?? "");
  const [bodyDraft, setBodyDraft] = useState(m.text);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setTitleDraft(m.microTitle ?? ""); }, [m.microTitle]);
  useEffect(() => { setBodyDraft(m.text); }, [m.text]);

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (editingBody && bodyRef.current) {
      bodyRef.current.focus();
      const len = bodyRef.current.value.length;
      bodyRef.current.setSelectionRange(len, len);
      autoResize(bodyRef.current);
    }
  }, [editingBody]);

  async function saveTitle() {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (next === (m.microTitle ?? "")) return;
    await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        widget: { ...m, microTitle: next || undefined },
        anonOwnerToken: ctx.ownerToken,
      }),
    });
    ctx.refresh();
  }

  async function saveBody() {
    const next = bodyDraft;
    setEditingBody(false);
    if (next === m.text) return;
    await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        widget: { ...m, text: next },
        anonOwnerToken: ctx.ownerToken,
      }),
    });
    ctx.refresh();
  }

  const emptyBody = !m.text.trim();

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "rich_text" ? (
          <div className="space-y-0.5">
            {s.microTitle && (
              <div className="mono text-[9px] tracking-widest opacity-60 uppercase">
                {s.microTitle}
              </div>
            )}
            <div className="text-[13px] leading-snug line-clamp-3">{s.text}</div>
          </div>
        ) : null
      }
    >
      <div className="space-y-2">
        {/* Micro-title row */}
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
              else if (e.key === "Escape") { e.preventDefault(); setTitleDraft(m.microTitle ?? ""); setEditingTitle(false); }
            }}
            placeholder="…"
            maxLength={60}
            className="mono text-[10px] tracking-widest uppercase bg-transparent border-0 outline-none px-0 py-0"
            style={{ color: "var(--v-muted)" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => { if (ctx.isOwner) setEditingTitle(true); }}
            disabled={!ctx.isOwner}
            className={`mono text-[10px] tracking-widest uppercase block ${ctx.isOwner ? "cursor-text" : "cursor-default"}`}
            style={{
              color: m.microTitle ? "var(--v-muted)" : "var(--v-rule-strong, var(--v-rule))",
              background: "transparent",
              border: "none",
              padding: 0,
              textAlign: "left",
            }}
          >
            {m.microTitle || "…"}
          </button>
        )}

        {/* Body */}
        {editingBody ? (
          <textarea
            ref={bodyRef}
            value={bodyDraft}
            onChange={(e) => {
              setBodyDraft(e.target.value);
              autoResize(e.currentTarget);
            }}
            onBlur={saveBody}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                saveBody();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setBodyDraft(m.text);
                setEditingBody(false);
              }
            }}
            placeholder={m.placeholder ?? ""}
            maxLength={4000}
            rows={3}
            className="vibe-heading text-[17px] sm:text-[19px] leading-relaxed w-full bg-transparent border-0 outline-none resize-none overflow-hidden max-w-2xl"
            style={{ color: "var(--v-fg)" }}
          />
        ) : (
          <p
            onClick={() => { if (ctx.isOwner) setEditingBody(true); }}
            className={`vibe-heading text-[17px] sm:text-[19px] leading-relaxed max-w-2xl whitespace-pre-wrap ${ctx.isOwner ? "cursor-text" : ""}`}
            style={{ color: emptyBody ? "var(--v-muted)" : "var(--v-fg)" }}
          >
            {emptyBody ? (m.placeholder ?? "…") : m.text}
          </p>
        )}
      </div>
    </WidgetShell>
  );
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
