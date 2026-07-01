"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { newLocalId } from "@/lib/id";
import { useWidgetContext } from "@/lib/widgetContext";
import type { ModuleStateEntry, PartsListWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { useInlineEdit } from "./useInlineEdit";

interface Item {
  key: string;
  name: string;
  quantity?: string;
  imageUrl?: string;
  authorName?: string;
  authorColor?: string;
  createdAt?: number;
}

/**
 * Utensilien — props, gear, wardrobe, products, surfaces, cables.
 *
 * The interaction mirrors the other productive list widgets: entries are
 * directly editable, removable, and added through one clear action. Seeded
 * preset items stay in widget config; collaborator items live in module_state.
 */
export function PartsListRenderer({
  module: m,
  index,
  state,
}: {
  module: PartsListWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const items = buildItems(m, state);
  const [adding, setAdding] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [pendingQty, setPendingQty] = useState("");
  const [pendingUrl, setPendingUrl] = useState("");

  async function add(keepOpen = false) {
    const name = cleanText(pendingName, 120);
    if (!name) {
      if (!keepOpen) setAdding(false);
      return;
    }
    const quantity = cleanText(pendingQty, 40);
    const imageUrl = cleanUrl(pendingUrl);
    setPendingName("");
    setPendingQty("");
    setPendingUrl("");
    if (!keepOpen) setAdding(false);
    await ctx.act(index, "add", {
      id: newLocalId("part"),
      name,
      quantity: quantity || undefined,
      imageUrl: imageUrl || undefined,
    });
  }

  async function updateItem(key: string, patch: Partial<Pick<Item, "name" | "quantity" | "imageUrl">>) {
    if (key.startsWith("seed-")) {
      const seedIndex = Number(key.slice(5));
      if (!Number.isInteger(seedIndex) || seedIndex < 0 || seedIndex >= m.items.length) return;
      const nextItems = m.items.map((item, i) => {
        if (i !== seedIndex) return item;
        const next = {
          ...item,
          ...(typeof patch.name === "string" ? { name: cleanText(patch.name, 120) } : {}),
          ...(typeof patch.quantity === "string" ? { quantity: cleanText(patch.quantity, 40) || undefined } : {}),
          ...(typeof patch.imageUrl === "string" ? { imageUrl: cleanUrl(patch.imageUrl) || undefined } : {}),
        };
        return next.name ? next : item;
      });
      await ctx.saveModule(index, { ...m, items: nextItems });
      return;
    }
    await ctx.act(index, "edit", { id: key, ...patch });
  }

  async function deleteItem(key: string) {
    if (key.startsWith("seed-")) {
      const seedIndex = Number(key.slice(5));
      if (!Number.isInteger(seedIndex)) return;
      await ctx.saveModule(index, { ...m, items: m.items.filter((_, i) => i !== seedIndex) });
      return;
    }
    await ctx.act(index, "edit", { id: key, deleted: true });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "parts_list" ? (
          <div className="truncate text-[11px] opacity-70">
            {s.items.map((it) => it.name).join(" · ")}
          </div>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={item.key}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
              >
                <PartRow item={item} onSave={(patch) => updateItem(item.key, patch)} onDelete={() => deleteItem(item.key)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="mt-3">
          {adding ? (
            <div className="space-y-2 rounded-[var(--v-radius)] p-2" style={{ border: "1px dashed var(--v-rule)" }}>
              <input
                autoFocus
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); add(true); }
                  else if (e.key === "Escape") { setAdding(false); setPendingName(""); setPendingQty(""); setPendingUrl(""); }
                }}
                placeholder="z. B. Stativ, Styling-Set, Produkt A"
                maxLength={120}
                className="w-full rounded-[var(--v-radius)] bg-transparent px-2 py-1 text-[13px] outline-none"
                style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
              />
              <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                <input
                  value={pendingQty}
                  onChange={(e) => setPendingQty(e.target.value)}
                  placeholder="Anzahl / Status"
                  maxLength={40}
                  className="mono rounded-[var(--v-radius)] bg-transparent px-2 py-1 text-[11px] outline-none"
                  style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                />
                <input
                  value={pendingUrl}
                  onChange={(e) => setPendingUrl(e.target.value)}
                  placeholder="Bild-URL optional"
                  maxLength={500}
                  className="mono rounded-[var(--v-radius)] bg-transparent px-2 py-1 text-[11px] outline-none"
                  style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                />
                <button
                  type="button"
                  onClick={() => add(false)}
                  disabled={!pendingName.trim()}
                  className="mono rounded-full px-3 py-1 text-[10px] tracking-widest disabled:opacity-30"
                  style={{ background: "var(--v-fg)", color: "var(--v-bg)" }}
                >
                  Speichern
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="Eintrag hinzufügen"
              className="mono rounded-full px-3 py-1 text-[10px] tracking-widest opacity-70 transition-opacity hover:opacity-100"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              {items.length === 0 ? "+ Ersten Eintrag hinzufügen" : "+ Eintrag hinzufügen"}
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function PartRow({
  item,
  onSave,
  onDelete,
}: {
  item: Item;
  onSave: (patch: Partial<Pick<Item, "name" | "quantity" | "imageUrl">>) => void;
  onDelete: () => void;
}) {
  const nameEdit = useInlineEdit<HTMLInputElement>({
    value: item.name,
    onSave: (name) => onSave({ name }),
    submitOn: "enter",
  });
  const quantityEdit = useInlineEdit<HTMLInputElement>({
    value: item.quantity ?? "",
    onSave: (quantity) => onSave({ quantity }),
    submitOn: "enter",
  });
  const imageEdit = useInlineEdit<HTMLInputElement>({
    value: item.imageUrl ?? "",
    onSave: (imageUrl) => onSave({ imageUrl }),
    submitOn: "enter",
  });

  return (
    <div className="group/part relative rounded-[var(--v-radius)] p-2" style={{ border: "1px solid var(--v-rule)", background: "rgba(255,255,255,0.03)" }}>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Eintrag entfernen"
        className="mono absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-[12px] leading-none opacity-0 transition-opacity hover:bg-white/10 group-hover/part:opacity-50 hover:!opacity-100"
        style={{ color: "var(--v-muted)" }}
      >
        ×
      </button>
      <div className="flex items-start gap-3 pr-7">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--v-rule)", background: "rgba(255,255,255,0.05)" }}>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center mono text-[9px] opacity-45" style={{ color: "var(--v-muted)" }}>
              Bild
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {nameEdit.editing ? (
            <input
              {...nameEdit.editProps}
              maxLength={120}
              placeholder="Eintrag benennen"
              className="w-full bg-transparent text-[13px] font-medium outline-none"
              style={{ color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => nameEdit.setEditing(true)}
              className="block w-full truncate text-left text-[13px] font-medium"
              style={{ color: item.name ? "var(--v-fg)" : "var(--v-muted)" }}
            >
              {item.name || "Eintrag benennen"}
            </button>
          )}

          <div className="grid gap-1.5 sm:grid-cols-2">
            <MiniField edit={quantityEdit} value={item.quantity ?? ""} placeholder="Anzahl / Status" />
            <MiniField edit={imageEdit} value={item.imageUrl ?? ""} placeholder="Bild-URL" />
          </div>
        </div>
        {item.authorName && (
          <ActorDot color={item.authorColor} displayName={item.authorName} size={14} />
        )}
      </div>
    </div>
  );
}

function MiniField({
  edit,
  value,
  placeholder,
}: {
  edit: ReturnType<typeof useInlineEdit<HTMLInputElement>>;
  value: string;
  placeholder: string;
}) {
  if (edit.editing) {
    return (
      <input
        {...edit.editProps}
        maxLength={500}
        placeholder={placeholder}
        className="mono w-full rounded-[10px] bg-transparent px-2 py-1 text-[10px] outline-none"
        style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => edit.setEditing(true)}
      className="mono block w-full truncate rounded-[10px] px-2 py-1 text-left text-[10px]"
      style={{ border: "1px solid var(--v-rule)", color: value ? "var(--v-muted)" : "var(--v-muted)" }}
    >
      {value || placeholder}
    </button>
  );
}

function buildItems(module: PartsListWidget, state: ModuleStateEntry[]): Item[] {
  const byId = new Map<string, Item>();
  const deleted = new Set<string>();

  module.items.forEach((item, i) => {
    const name = cleanText(item.name, 120);
    if (!name) return;
    byId.set(`seed-${i}`, {
      key: `seed-${i}`,
      name,
      quantity: cleanText(item.quantity, 40) || undefined,
      imageUrl: cleanUrl(item.imageUrl) || undefined,
    });
  });

  for (const e of state) {
    if (e.kind === "edit" && e.data.deleted === true && typeof e.data.id === "string") deleted.add(e.data.id);
    if (e.kind !== "add") continue;
    const id = typeof e.data.id === "string" ? e.data.id : e.id;
    const name = cleanText(e.data.name, 120);
    if (!name) continue;
    byId.set(id, {
      key: id,
      name,
      quantity: cleanText(e.data.quantity, 40) || undefined,
      imageUrl: cleanUrl(e.data.imageUrl) || undefined,
      authorName: e.actor.displayName,
      authorColor: typeof e.data.color === "string" ? e.data.color : undefined,
      createdAt: e.createdAt,
    });
  }

  for (const e of state) {
    if (e.kind !== "edit") continue;
    const id = typeof e.data.id === "string" ? e.data.id : "";
    const current = byId.get(id);
    if (!current) continue;
    const next = {
      ...current,
      name: typeof e.data.name === "string" ? cleanText(e.data.name, 120) : current.name,
      quantity: typeof e.data.quantity === "string" ? cleanText(e.data.quantity, 40) || undefined : current.quantity,
      imageUrl: typeof e.data.imageUrl === "string" ? cleanUrl(e.data.imageUrl) || undefined : current.imageUrl,
    };
    if (next.name) byId.set(id, next);
  }

  return Array.from(byId.values())
    .filter((item) => !deleted.has(item.key))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

function cleanText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text === "…" || text === "..." ? "" : text.slice(0, max);
}

function cleanUrl(value: unknown): string {
  const text = cleanText(value, 500);
  return /^https?:\/\/[^\s]+$/i.test(text) ? text : "";
}
