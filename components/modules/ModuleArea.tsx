"use client";

import { useState } from "react";
import type { Card, CardModule } from "@/lib/types";
import { ModuleDisplay, ModuleEditor } from "./ModuleDispatch";
import { ModulePicker } from "./ModulePicker";

/**
 * ModuleArea — the surface that owns the module on a Thing detail
 * page. Exactly one module per thing. The area handles:
 *
 *   • empty + owner: "✦ Help shape this" (AI) + "+ Pick a module
 *     yourself" (manual)
 *   • populated + non-owner: just the display
 *   • populated + owner: display + ✎ EDIT / ↻ SWITCH TYPE / ✕ REMOVE
 *   • editing: the editor matching the picked type, seeded with
 *     existing data if any
 *   • picking: ModulePicker, with the current type highlighted
 *
 * All writes go through PATCH /api/cards/[id] with a fresh
 * single-element `modules` array; remove sends an empty array.
 */
export function ModuleArea({
  card,
  mine,
  onChanged,
}: {
  card: Card;
  mine: boolean;
  onChanged: () => void;
}) {
  const module = card.modules[0] as CardModule | undefined;

  const [editingType, setEditingType] = useState<CardModule["type"] | null>(null);
  const [editorInitial, setEditorInitial] = useState<CardModule | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickerHint, setPickerHint] = useState<string>("");
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(m: CardModule) {
    setEditingType(m.type);
    setEditorInitial(m);
    setPicking(false);
    setError("");
  }

  function startPick(hint = "") {
    setPicking(true);
    setPickerHint(hint);
    setEditingType(null);
    setEditorInitial(null);
    setError("");
  }

  function pickType(type: CardModule["type"]) {
    setEditingType(type);
    setEditorInitial(
      // If we're switching from an existing module of a different type,
      // start the editor empty rather than try to translate values.
      module && module.type === type ? module : null,
    );
    setPicking(false);
    setPickerHint("");
  }

  async function suggest() {
    if (suggesting) return;
    setSuggesting(true);
    setError("");
    try {
      const res = await fetch(`/api/cards/${card.id}/suggest-modules`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error || "suggest_failed");
        return;
      }
      const list: CardModule[] = Array.isArray(json.modules) ? json.modules : [];
      const proposed = list[0];
      if (proposed) {
        setEditingType(proposed.type);
        setEditorInitial(proposed);
      } else {
        // The AI saw the thing and decided nothing fit cleanly. Open the
        // manual picker right away so the creator can keep moving
        // without an extra click.
        startPick("Nothing fit cleanly. Pick a shape yourself.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function save(next: CardModule) {
    setSaving(true);
    try {
      await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modules: [next] }),
      });
      setEditingType(null);
      setEditorInitial(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Remove the module from this thing?")) return;
    setSaving(true);
    try {
      await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modules: [] }),
      });
      setEditingType(null);
      setEditorInitial(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  // ──────── render ────────

  if (editingType) {
    return (
      <ModuleEditor
        type={editingType}
        initial={editorInitial}
        onSave={save}
        onCancel={() => {
          setEditingType(null);
          setEditorInitial(null);
        }}
        onRemove={module ? remove : undefined}
      />
    );
  }

  if (picking) {
    return (
      <ModulePicker
        current={module?.type}
        onPick={pickType}
        onCancel={() => { setPicking(false); setPickerHint(""); }}
        hint={pickerHint || undefined}
      />
    );
  }

  if (module) {
    return (
      <div className="space-y-2">
        <ModuleDisplay module={module} />
        {mine && (
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button
              onClick={() => startEdit(module)}
              disabled={saving}
              className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
            >
              ✎ EDIT
            </button>
            <button
              onClick={() => startPick()}
              disabled={saving}
              className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
            >
              ↻ SWITCH TYPE
            </button>
            <button
              onClick={remove}
              disabled={saving}
              className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
            >
              ✕ REMOVE
            </button>
          </div>
        )}
      </div>
    );
  }

  if (mine) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={suggest}
          disabled={suggesting}
          className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 underline underline-offset-2"
        >
          {suggesting ? "✦ thinking…" : "✦ Help shape this"}
        </button>
        <button
          onClick={() => startPick()}
          className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100"
        >
          + Pick a module yourself
        </button>
        {error && (
          <span className="mono text-[10px] text-red-700">{error.toUpperCase()}</span>
        )}
      </div>
    );
  }

  return null;
}
