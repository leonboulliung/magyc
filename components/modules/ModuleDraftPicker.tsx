"use client";

import { useState } from "react";
import type { CardModule } from "@/lib/types";
import { ModuleDisplay, ModuleEditor } from "./ModuleDispatch";
import { ModulePicker } from "./ModulePicker";

/**
 * Draft-mode picker for a single module — used in the create form
 * before the card has an id. Mirrors ModuleArea on the detail page but
 * calls the draft suggest endpoint instead of the per-card one.
 *
 * AI-first by design: the creator can press "✦ Help shape this" and
 * the model returns either nothing (which is honest information — the
 * thing didn't need a module) or one fitting module skeleton ready to
 * fill in. Manual pick is the fallback for power users who already
 * know which module they want.
 *
 * `context` carries the form draft (title, description, tags) that the
 * AI reads from. Without context, the AI button is hidden and only
 * the manual path is offered.
 */
export function ModuleDraftPicker({
  value,
  onChange,
  context,
}: {
  value: CardModule | null;
  onChange: (next: CardModule | null) => void;
  context?: { title: string; description: string; tags: string[] };
}) {
  const [picking, setPicking] = useState(false);
  const [pickerHint, setPickerHint] = useState<string>("");
  const [editingType, setEditingType] = useState<CardModule["type"] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");

  function startPick(hint = "") {
    setPicking(true);
    setPickerHint(hint);
    setEditingType(null);
    setError("");
  }
  function pickType(type: CardModule["type"]) {
    setPicking(false);
    setPickerHint("");
    setEditingType(type);
  }

  async function suggest() {
    if (suggesting || !context) return;
    const title = context.title.trim();
    if (title.length < 3) {
      setError("title_too_short");
      return;
    }
    setSuggesting(true);
    setError("");
    try {
      const res = await fetch("/api/cards/suggest-modules-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description: context.description,
          tags: context.tags,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error || "suggest_failed");
        return;
      }
      const list: CardModule[] = Array.isArray(json.modules) ? json.modules : [];
      const proposed = list[0];
      if (proposed) {
        setEditingType(proposed.type);
        // Stash the suggestion so the editor opens prefilled.
        // We sneak it in via onChange so the value/type logic below
        // picks the right initial seed.
        onChange(proposed);
      } else {
        // The AI looked at the draft and didn't see a clean fit. Drop
        // straight into the manual picker so the creator can keep
        // moving without an extra click.
        startPick("Nothing fit cleanly. Pick a shape yourself.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  if (editingType) {
    return (
      <ModuleEditor
        type={editingType}
        // Only seed the editor with the current value if it's of the
        // same type — switching types should start blank.
        initial={value && value.type === editingType ? value : null}
        onSave={(next) => {
          onChange(next);
          setEditingType(null);
        }}
        onCancel={() => setEditingType(null)}
        onRemove={value ? () => { onChange(null); setEditingType(null); } : undefined}
      />
    );
  }

  if (picking) {
    return (
      <ModulePicker
        current={value?.type}
        onPick={pickType}
        onCancel={() => { setPicking(false); setPickerHint(""); }}
        hint={pickerHint || undefined}
      />
    );
  }

  if (value) {
    return (
      <div className="space-y-2">
        <ModuleDisplay module={value} />
        <div className="flex items-center gap-3 flex-wrap pt-1">
          <button
            type="button"
            onClick={() => setEditingType(value.type)}
            className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
          >
            ✎ EDIT
          </button>
          <button
            type="button"
            onClick={() => startPick()}
            className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
          >
            ↻ SWITCH TYPE
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
          >
            ✕ REMOVE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {context && (
        <button
          type="button"
          onClick={suggest}
          disabled={suggesting}
          className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 underline underline-offset-2"
        >
          {suggesting ? "✦ thinking…" : "✦ Help shape this"}
        </button>
      )}
      <button
        type="button"
        onClick={() => startPick()}
        className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
      >
        + Pick a module yourself
      </button>
      {error === "title_too_short" && (
        <span className="mono text-[10px] opacity-60">
          Add a title first, then I can help.
        </span>
      )}
      {error && error !== "title_too_short" && (
        <span className="mono text-[10px] text-red-700">{error.toUpperCase()}</span>
      )}
    </div>
  );
}
