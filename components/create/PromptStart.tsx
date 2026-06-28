"use client";

import { useState, type Ref } from "react";
import { PromptComposer } from "@/components/PromptComposer";
import type { StudioPreset } from "@/lib/studioPresets";
import type { FastPrompt } from "@/lib/studioProfile";

export const DEFAULT_CREATE_FAST_PROMPTS: FastPrompt[] = [
  {
    text: "Der Kunde soll vorab 2–3 Referenzen zur gewünschten Bildsprache schicken.",
    color: "#8b7bff",
  },
  {
    text: "Bitte plane eine klare Shotlist mit Must-have-Motiven und optionalen Zusatzmotiven.",
    color: "#4aa8ff",
  },
  {
    text: "Es sollen Deliverables für Website, Social Media und Archiv vorbereitet werden.",
    color: "#39d2b4",
  },
  {
    text: "Der Kunde soll eine Auswahlrunde mit Favoriten und finaler Freigabe bekommen.",
    color: "#f5b740",
  },
];

type PromptPreset = Pick<StudioPreset, "id" | "name" | "modules">;

export function PromptStart({
  id,
  inputRef,
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
  rows = 5,
  highlight,
  presets,
  selectedPresetId,
  onPresetChange,
  fastPrompts = [],
  onFastPrompt,
  showFastPrompts = true,
  className,
}: {
  id?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  rows?: number;
  highlight?: boolean;
  presets: PromptPreset[];
  selectedPresetId: string;
  onPresetChange: (id: string) => void;
  fastPrompts?: FastPrompt[];
  onFastPrompt: (hint: string) => void;
  showFastPrompts?: boolean;
  className?: string;
}) {
  const [fastPromptsOpen, setFastPromptsOpen] = useState(true);
  const showPresetChoice = presets.length > 0;

  return (
    <div className={className}>
      <PromptComposer
        id={id}
        ref={inputRef}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={rows}
        highlight={highlight}
        placeholder="z. B. Produktshooting für eine handgemachte Keramik-Serie, clean und warm …"
        theme="light"
        topSlot={showPresetChoice ? (
          <div className="flex flex-wrap gap-2">
            <PresetChip
              active={selectedPresetId === "none"}
              onClick={() => onPresetChange("none")}
              label="Ohne Preset"
              disabled={disabled}
            />
            {presets.map((preset) => (
              <PresetChip
                key={preset.id}
                active={selectedPresetId === preset.id}
                onClick={() => onPresetChange(preset.id)}
                label={preset.name}
                disabled={disabled}
              />
            ))}
          </div>
        ) : undefined}
      />

      {showFastPrompts && fastPrompts.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white">
          <button
            type="button"
            onClick={() => setFastPromptsOpen((open) => !open)}
            className="flex w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-black/[0.03]"
          >
            <span className="mono text-[10px] uppercase tracking-widest text-black/55">
              Schnellbausteine <span className="text-black/35">({fastPrompts.length})</span>
            </span>
            <Chevron open={fastPromptsOpen} />
          </button>
          {fastPromptsOpen && (
            <div className="max-h-72 overflow-y-auto border-t border-black/10">
              {fastPrompts.map((fastPrompt, index) => (
                <button
                  key={`${index}:${fastPrompt.text}`}
                  type="button"
                  onClick={() => onFastPrompt(fastPrompt.text)}
                  disabled={disabled}
                  className="flex w-full items-start gap-2.5 border-b border-black/[0.06] px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-black/[0.04] disabled:opacity-40"
                  style={fastPrompt.color ? { borderLeft: `3px solid ${fastPrompt.color}` } : undefined}
                >
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: fastPrompt.color ?? "rgba(0,0,0,0.25)" }}
                  />
                  <span className="text-[13.5px] leading-snug text-black/75">{fastPrompt.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PresetChip({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-3.5 py-2 text-[12px] tracking-wide transition-colors disabled:opacity-40"
      style={{
        border: "1px solid",
        borderColor: active ? "#17171a" : "rgba(0,0,0,0.15)",
        background: active ? "#17171a" : "rgba(0,0,0,0.02)",
        color: active ? "#fff" : "rgba(0,0,0,0.65)",
      }}
    >
      {label}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="shrink-0 text-black/40 transition-transform duration-200"
      style={{ transform: open ? "rotate(180deg)" : "none" }}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
