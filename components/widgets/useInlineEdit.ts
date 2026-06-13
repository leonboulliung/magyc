"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Grow a textarea to fit its content (no inner scrollbar). */
export function autoResizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

interface InlineEditOptions {
  /** The persisted value the field edits. */
  value: string;
  /** Persist a changed value. Only called when the (optionally trimmed)
   *  draft differs from `value`. Return value is ignored (fire-and-forget),
   *  so `ctx.saveModule`'s `Promise<boolean>` slots in directly. */
  onSave: (next: string) => unknown;
  /** "enter" → plain Enter saves (single-line feel; Shift+Enter still
   *  inserts a newline). "modEnter" → Cmd/Ctrl+Enter saves, plain Enter
   *  is a newline (multi-line prose). Default "modEnter". */
  submitOn?: "enter" | "modEnter";
  /** Trim before compare + save. Default true; set false to preserve
   *  leading/trailing whitespace (rich-text body). */
  trim?: boolean;
  /** On focus: "end" places the caret at the end (textarea), "all"
   *  selects everything (short input). Default "end". */
  focusMode?: "end" | "all";
  /** Auto-grow the textarea as it's typed. Default false. */
  autoGrow?: boolean;
}

/**
 * useInlineEdit — the shared click-to-edit behaviour every text widget
 * had hand-rolled: draft state synced to the prop, focus/selection on
 * entry, Enter/Cmd-Enter to save, Escape to cancel, save-on-blur, and
 * optional textarea auto-grow. Renderers keep their own markup/styling
 * and just spread `editProps` onto the field.
 */
export function useInlineEdit<E extends HTMLTextAreaElement | HTMLInputElement>({
  value,
  onSave,
  submitOn = "modEnter",
  trim = true,
  focusMode = "end",
  autoGrow = false,
}: InlineEditOptions) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<E>(null);

  // Keep the draft in sync when the persisted value changes underneath
  // us (realtime edit, regenerate, undo).
  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    el.focus();
    if (focusMode === "all") {
      el.select();
    } else {
      const len = el.value.length;
      el.setSelectionRange(len, len);
      if (autoGrow && el instanceof HTMLTextAreaElement) autoResizeTextarea(el);
    }
  }, [editing, focusMode, autoGrow]);

  const commit = useCallback(() => {
    setEditing(false);
    const next = trim ? draft.trim() : draft;
    if (next === value) return;
    void onSave(next);
  }, [draft, onSave, trim, value]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const onChange = useCallback((e: React.ChangeEvent<E>) => {
    setDraft(e.target.value);
    if (autoGrow && e.currentTarget instanceof HTMLTextAreaElement) {
      autoResizeTextarea(e.currentTarget);
    }
  }, [autoGrow]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<E>) => {
    const submit = submitOn === "enter"
      ? e.key === "Enter" && !e.shiftKey
      : e.key === "Enter" && (e.metaKey || e.ctrlKey);
    if (submit) { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  }, [submitOn, commit, cancel]);

  return {
    editing,
    setEditing,
    draft,
    cancel,
    commit,
    /** Spread onto the <textarea> / <input>. */
    editProps: { ref, value: draft, onChange, onBlur: commit, onKeyDown },
  };
}
