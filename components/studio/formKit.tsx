"use client";

import { useState, type ReactNode } from "react";
import type { SaveStatus } from "@/components/studio/useStudioProfile";

/**
 * formKit — the shared visual primitives for the account-area editors
 * (Profil, Einstellungen, Vertragsinhalte, Nutzer). One look, one set of
 * field styles, so every settings surface reads the same. Purely presentational.
 */

const FIELD =
  "w-full rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 transition-colors focus:border-white/35";

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
        <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">{eyebrow}</p>
        <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-white sm:text-[32px]">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/55">{children}</div>}
      </div>
      {status && (
        <span className="mono mt-2 shrink-0 text-[11px] tracking-widest text-white/35">
          {status === "loading" ? "Lädt …" : status === "saving" ? "Speichert …" : status === "error" ? "Nicht gespeichert" : "✓ Gespeichert"}
        </span>
      )}
    </div>
  );
}

export function Card({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      {title && <h2 className="text-[15px] font-semibold text-white">{title}</h2>}
      {hint && <p className="mt-1 text-[13px] leading-relaxed text-white/45">{hint}</p>}
      <div className={title || hint ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] leading-snug text-white/35">{hint}</span>}
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
        <option key={o.value} value={o.value} className="bg-[#16181b]">{o.label}</option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 text-left">
      <span>
        <span className="block text-[14px] text-white/85">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-white/40">{hint}</span>}
      </span>
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "#fff" : "rgba(255,255,255,0.15)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
          style={{ left: 2, background: checked ? "#000" : "#fff", transform: checked ? "translateX(20px)" : "none" }}
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
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${on ? "border-white bg-white text-black" : "border-white/15 text-white/65 hover:border-white/35 hover:text-white"}`}
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
    <div className="inline-flex flex-wrap gap-1 rounded-full border border-white/12 bg-white/[0.03] p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${on ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
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
        {items.length === 0 && emptyHint && <p className="text-[13px] text-white/35">{emptyHint}</p>}
        {items.map((it, i) => (
          <div key={i} className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
            <span className="mono mt-0.5 text-[12px] leading-none text-white/30">{glyph}</span>
            <span className="flex-1 text-[14px] leading-snug text-white/85">{it}</span>
            <button type="button" onClick={() => onRemove(i)} aria-label="Entfernen" className="text-white/30 opacity-0 transition-opacity hover:text-white group-hover:opacity-100">×</button>
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
      <button type="button" onClick={commit} disabled={!input.trim()} className="shrink-0 rounded-xl bg-white px-4 text-[14px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-40">
        Hinzufügen
      </button>
    </div>
  );
}
