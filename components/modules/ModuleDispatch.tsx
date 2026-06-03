"use client";

import type { CardModule } from "@/lib/types";
import { ModuleBrief, ModuleBriefEditor } from "./ModuleBrief";
import { ModuleRoadmap, ModuleRoadmapEditor } from "./ModuleRoadmap";
import { ModuleChecklist, ModuleChecklistEditor } from "./ModuleChecklist";
import { ModuleBring, ModuleBringEditor } from "./ModuleBring";
import { ModuleKV, ModuleKVEditor } from "./ModuleKV";
import { ModuleMoodboard, ModuleMoodboardEditor } from "./ModuleMoodboard";
import { ModuleSetlist, ModuleSetlistEditor } from "./ModuleSetlist";
import { ModuleReflist, ModuleReflistEditor } from "./ModuleReflist";

/** Display dispatch: render the right module surface for a typed module. */
export function ModuleDisplay({ module: m }: { module: CardModule }) {
  switch (m.type) {
    case "brief":     return <ModuleBrief text={m.text} />;
    case "roadmap":   return <ModuleRoadmap steps={m.steps} />;
    case "checklist": return <ModuleChecklist items={m.items} />;
    case "bring":     return <ModuleBring items={m.items} />;
    case "kv":        return <ModuleKV entries={m.entries} />;
    case "moodboard": return <ModuleMoodboard refs={m.refs} />;
    case "setlist":   return <ModuleSetlist items={m.items} />;
    case "reflist":   return <ModuleReflist items={m.items} />;
  }
}

/**
 * Editor dispatch: render the right editor for the given type,
 * optionally seeded with an existing module's data. `onSave` receives
 * a fully-typed module ready to send to the PATCH route.
 */
export function ModuleEditor({
  type,
  initial,
  onSave,
  onCancel,
  onRemove,
}: {
  type: CardModule["type"];
  initial: CardModule | null;
  onSave: (next: CardModule) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  switch (type) {
    case "brief": {
      const init = initial && initial.type === "brief" ? initial.text : "";
      return (
        <ModuleBriefEditor
          initial={init}
          onCancel={onCancel}
          onRemove={onRemove}
          onSave={(text) => {
            if (text.trim()) onSave({ type: "brief", text: text.trim() });
            else if (onRemove) onRemove();
            else onCancel();
          }}
        />
      );
    }
    case "roadmap": {
      const init = initial && initial.type === "roadmap" ? initial.steps : undefined;
      return (
        <ModuleRoadmapEditor
          initial={init}
          onCancel={onCancel}
          onRemove={onRemove}
          onSave={(steps) => {
            if (steps.length > 0) onSave({ type: "roadmap", steps });
            else if (onRemove) onRemove();
            else onCancel();
          }}
        />
      );
    }
    case "checklist": {
      const init = initial && initial.type === "checklist" ? initial.items : undefined;
      return (
        <ModuleChecklistEditor
          initial={init}
          onCancel={onCancel}
          onRemove={onRemove}
          onSave={(items) => {
            if (items.length > 0) onSave({ type: "checklist", items });
            else if (onRemove) onRemove();
            else onCancel();
          }}
        />
      );
    }
    case "bring": {
      const init = initial && initial.type === "bring" ? initial.items : undefined;
      return (
        <ModuleBringEditor
          initial={init}
          onCancel={onCancel}
          onRemove={onRemove}
          onSave={(items) => {
            if (items.length > 0) onSave({ type: "bring", items });
            else if (onRemove) onRemove();
            else onCancel();
          }}
        />
      );
    }
    case "kv": {
      const init = initial && initial.type === "kv" ? initial.entries : undefined;
      return (
        <ModuleKVEditor
          initial={init}
          onCancel={onCancel}
          onRemove={onRemove}
          onSave={(entries) => {
            if (entries.length > 0) onSave({ type: "kv", entries });
            else if (onRemove) onRemove();
            else onCancel();
          }}
        />
      );
    }
    case "moodboard": {
      const init = initial && initial.type === "moodboard" ? initial.refs : undefined;
      return (
        <ModuleMoodboardEditor
          initial={init}
          onCancel={onCancel}
          onRemove={onRemove}
          onSave={(refs) => {
            if (refs.length > 0) onSave({ type: "moodboard", refs });
            else if (onRemove) onRemove();
            else onCancel();
          }}
        />
      );
    }
    case "setlist": {
      const init = initial && initial.type === "setlist" ? initial.items : undefined;
      return (
        <ModuleSetlistEditor
          initial={init}
          onCancel={onCancel}
          onRemove={onRemove}
          onSave={(items) => {
            if (items.length > 0) onSave({ type: "setlist", items });
            else if (onRemove) onRemove();
            else onCancel();
          }}
        />
      );
    }
    case "reflist": {
      const init = initial && initial.type === "reflist" ? initial.items : undefined;
      return (
        <ModuleReflistEditor
          initial={init}
          onCancel={onCancel}
          onRemove={onRemove}
          onSave={(items) => {
            if (items.length > 0) onSave({ type: "reflist", items });
            else if (onRemove) onRemove();
            else onCancel();
          }}
        />
      );
    }
  }
}
