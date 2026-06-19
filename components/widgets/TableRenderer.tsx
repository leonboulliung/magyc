"use client";

import { useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { TableWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Tabelle — generic comparison grid. Owner can edit any cell inline,
 * add or remove rows / columns. Visitors see read-only.
 *
 * Edit model: replaces the whole widget config (no per-cell collab
 * state). The PUT endpoint snapshots a new version on published
 * spaces, so the table history travels with the version bar.
 */
export function TableRenderer({
  module: m,
  index,
}: {
  module: TableWidget;
  index: number;
}) {
  const ctx = useWidgetContext();

  async function save(next: TableWidget) {
    await ctx.saveModule(index, next);
  }

  function setCell(r: number, c: number, value: string) {
    const rows = m.rows.map((row) => [...row]);
    while (rows[r].length < m.columns.length) rows[r].push("");
    rows[r][c] = value;
    save({ ...m, rows });
  }

  function setColumn(c: number, value: string) {
    const columns = [...m.columns];
    columns[c] = value;
    save({ ...m, columns });
  }

  function addColumn() {
    const columns = [...m.columns, ""];
    // With no rows yet (e.g. a one-column table), the new column would have
    // no editable cell and "+ col" would appear to do nothing — seed a row.
    const rows = m.rows.length ? m.rows.map((r) => [...r, ""]) : [new Array(columns.length).fill("")];
    save({ ...m, columns, rows });
  }

  function addRow() {
    save({ ...m, rows: [...m.rows, new Array(m.columns.length).fill("")] });
  }

  function removeColumn(c: number) {
    if (m.columns.length <= 1) return;
    save({
      ...m,
      columns: m.columns.filter((_, i) => i !== c),
      rows: m.rows.map((r) => r.filter((_, i) => i !== c)),
    });
  }

  function removeRow(r: number) {
    save({ ...m, rows: m.rows.filter((_, i) => i !== r) });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "table" ? (
          <div className="text-[11px] opacity-70 truncate">
            {s.columns.join(" · ")}
            {s.rows.length > 0 && ` · ${s.rows.length} rows`}
          </div>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {m.columns.map((col, c) => (
                  <th
                    key={c}
                    className="group/col text-left px-2 py-1.5"
                    style={{ borderBottom: "1px solid var(--v-rule)", color: "var(--v-muted)" }}
                  >
                    <CellEditor
                      value={col}
                      isOwner={ctx.isOwner}
                      onSave={(v) => setColumn(c, v)}
                      mono
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.rows.map((row, r) => (
                <tr key={r} className="group/row">
                  {m.columns.map((_, c) => (
                    <td
                      key={c}
                      className="px-2 py-1.5 align-top"
                      style={{ borderBottom: "1px solid var(--v-rule)" }}
                    >
                      <CellEditor
                        value={row[c] ?? ""}
                        isOwner={ctx.isOwner}
                        onSave={(v) => setCell(r, c, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ctx.isOwner && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={addRow} className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full opacity-70 hover:opacity-100" style={{ border: "1px dashed var(--v-rule)" }}>
              + row
            </button>
            <button onClick={addColumn} className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full opacity-70 hover:opacity-100" style={{ border: "1px dashed var(--v-rule)" }}>
              + col
            </button>
            {m.rows.length > 0 && (
              <button onClick={() => removeRow(m.rows.length - 1)} className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full opacity-50 hover:opacity-100">
                − row
              </button>
            )}
            {m.columns.length > 1 && (
              <button onClick={() => removeColumn(m.columns.length - 1)} className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full opacity-50 hover:opacity-100">
                − col
              </button>
            )}
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}

function CellEditor({
  value,
  onSave,
  isOwner,
  mono = false,
}: {
  value: string;
  onSave: (v: string) => void;
  isOwner: boolean;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        maxLength={200}
        className={`w-full bg-transparent outline-none ${mono ? "mono text-[10px] tracking-widest uppercase" : "text-[12px]"}`}
        style={{ color: "var(--v-fg)" }}
      />
    );
  }
  return (
    <div
      onClick={() => { if (isOwner) setEditing(true); }}
      className={`min-h-[18px] ${isOwner ? "cursor-text" : ""} ${mono ? "mono text-[10px] tracking-widest uppercase" : "text-[12px]"}`}
      style={{ color: value ? "var(--v-fg)" : "var(--v-muted)" }}
    >
      {value || "…"}
    </div>
  );
}
