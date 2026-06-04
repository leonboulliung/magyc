"use client";

import { useState } from "react";
import type { CardModule } from "@/lib/types";
import { ModuleDisplay, ModuleEditor } from "./ModuleDispatch";
import { ModulePicker } from "./ModulePicker";

/**
 * Draft-mode picker for a single module — used in the create form
 * before the card has an id. No API calls; the parent owns the value
 * via `value`/`onChange`. Mirrors the lifecycle of ModuleArea (empty
 * → picking → editing → display) without the server round-trips and
 * without the AI-suggest path (there's no card yet for the model to
 * read from).
 */
export function ModuleDraftPicker({
  value,
  onChange,
}: {
  value: CardModule | null;
  onChange: (next: CardModule | null) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [editingType, setEditingType] = useState<CardModule["type"] | null>(null);

  function startPick() {
    setPicking(true);
    setEditingType(null);
  }
  function pickType(type: CardModule["type"]) {
    setPicking(false);
    setEditingType(type);
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
        onCancel={() => setPicking(false)}
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
            onClick={startPick}
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
    <button
      type="button"
      onClick={startPick}
      className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 underline underline-offset-2"
    >
      + Pick a module
    </button>
  );
}
