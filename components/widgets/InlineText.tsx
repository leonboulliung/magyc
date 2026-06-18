"use client";

import { useEffect, useState } from "react";

/**
 * InlineText — click-to-edit text for owner-editable widget CONFIG fields
 * (poll question/options, crew roles, work-package labels, …). For
 * non-owners it renders as plain text. On commit it calls `onSave(trimmed)`
 * only when the value actually changed; the parent persists via
 * `ctx.saveModule`. Mirrors the inline-edit pattern from TableRenderer so
 * config widgets feel consistent.
 */
export function InlineText({
  value,
  onSave,
  isOwner,
  placeholder = "…",
  className = "",
  multiline = false,
  maxLength = 280,
}: {
  value: string;
  onSave: (v: string) => void;
  isOwner: boolean;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (!isOwner) {
    return (
      <span className={className} style={{ color: value ? "var(--v-fg)" : "var(--v-muted)" }}>
        {value || placeholder}
      </span>
    );
  }

  function commit() {
    setEditing(false);
    const v = draft.trim();
    if (v !== value) onSave(v);
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          rows={2}
          value={draft}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          className={`w-full resize-none bg-transparent outline-none ${className}`}
          style={{ color: "var(--v-fg)" }}
        />
      );
    }
    return (
      <input
        autoFocus
        value={draft}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={`w-full bg-transparent outline-none ${className}`}
        style={{ color: "var(--v-fg)" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`text-left ${className}`}
      style={{ color: value ? "var(--v-fg)" : "var(--v-muted)", cursor: "text" }}
    >
      {value || placeholder}
    </button>
  );
}
