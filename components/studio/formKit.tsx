"use client";

import { useState, type ReactNode } from "react";
import type { SaveStatus } from "@/components/studio/useStudioProfile";

/**
 * formKit — the shared visual primitives for the account-area editors
 * (Profil, Einstellungen, Vertragsinhalte, Nutzer). One light look, one set of
 * field styles, so every settings surface reads the same. Purely presentational.
 */

const INK = "#17171a";
const FIELD =
  "w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-[14px] text-[#17171a] outline-none placeholder:text-black/30 transition-colors focus:border-black/45";

export function PageHeader({
  eyebrow,
  title,
  status,
  children,
}: {
  eyebrow: string;
  title: string;
  status?: SaveStatus;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="mono text-[11px] uppercase tracking-[0.22em] text-black/45">{eyebrow}</p>
        <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-[#17171a] sm:text-[32px]">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-[14px] leading-relaxed text-black/55">{children}</div>}
      </div>
      {status && (
        <span className="mono mt-2 shrink-0 text-[11px] tracking-widest text-black/40">
          {status === "loading" ? "Lädt …" : status === "saving" ? "Speichert …" : status === "error" ? "Nicht gespeichert" : "✓ Gespeichert"}
        </span>
      )}
    </div>
  );
}

export function Card({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
      {title && <h2 className="text-[15px] font-semibold text-[#17171a]">{title}</h2>}
      {hint && <p className="mt-1 text-[13px] leading-relaxed text-black/45">{hint}</p>}
      <div className={title || hint ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-widest text-black/45">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] leading-snug text-black/40">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD} mt-1.5 ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${FIELD} mt-1.5 resize-none leading-relaxed ${props.className ?? ""}`} />;
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={`${FIELD} mt-1.5 appearance-none ${props.className ?? ""}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-white text-black">{o.label}</option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 text-left">
      <span>
        <span className="block text-[14px] text-[#17171a]">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-black/45">{hint}</span>}
      </span>
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? INK : "rgba(0,0,0,0.18)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
          style={{ left: 2, transform: checked ? "translateX(20px)" : "none" }}
        />
      </span>
    </button>
  );
}

/** A wrapping multi-select rendered as toggleable chips. */
export function Chips<T extends string>({ options, selected, onToggle }: { options: readonly { value: T; label: string }[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${on ? "border-[#17171a] bg-[#17171a] text-white" : "border-black/15 text-black/65 hover:border-black/40 hover:text-black"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A single-choice segmented control. */
export function Segmented<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full border border-black/12 bg-black/[0.03] p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${on ? "bg-[#17171a] text-white" : "text-black/55 hover:text-black"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Add/remove editor for a free-form string list (rules, specialties). */
export function TagEditor({
  items,
  onAdd,
  onRemove,
  placeholder,
  glyph = "•",
  emptyHint,
  maxLength = 200,
}: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
  glyph?: string;
  emptyHint?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <div className="space-y-2">
        {items.length === 0 && emptyHint && <p className="text-[13px] text-black/40">{emptyHint}</p>}
        {items.map((it, i) => (
          <div key={i} className="group flex items-start gap-3 rounded-xl border border-black/10 bg-black/[0.015] px-3.5 py-2.5">
            <span className="mono mt-0.5 text-[12px] leading-none text-black/30">{glyph}</span>
            <span className="flex-1 text-[14px] leading-snug text-black/80">{it}</span>
            <button type="button" onClick={() => onRemove(i)} aria-label="Entfernen" className="text-black/30 opacity-0 transition-opacity hover:text-black group-hover:opacity-100">×</button>
          </div>
        ))}
      </div>
      <AddRow placeholder={placeholder} maxLength={maxLength} onAdd={onAdd} />
    </div>
  );
}

function AddRow({ placeholder, maxLength, onAdd }: { placeholder: string; maxLength: number; onAdd: (v: string) => void }) {
  const [input, setInput] = useState("");
  function commit() {
    const v = input.trim();
    setInput("");
    if (v) onAdd(v);
  }
  return (
    <div className="mt-3 flex gap-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        placeholder={placeholder}
        maxLength={maxLength}
        className={FIELD}
      />
      <button type="button" onClick={commit} disabled={!input.trim()} className="shrink-0 rounded-xl bg-[#17171a] px-4 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
        Hinzufügen
      </button>
    </div>
  );
}
