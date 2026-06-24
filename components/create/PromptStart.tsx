"use client";

import { PromptComposer } from "@/components/PromptComposer";
import { PROJECT_MODES, projectModeById, type ProjectModeId } from "@/lib/projectModes";
import type { ReactNode, Ref } from "react";

const DEFAULT_EXAMPLES: { prompt: string; mode?: ProjectModeId }[] = [
  { prompt: "Plan a fashion shoot in Berlin.", mode: "photo_shoot" },
  { prompt: "Create a launch plan for a neighborhood cafe.", mode: "campaign" },
  { prompt: "Organize a podcast episode with guests and production tasks." },
];

const DEFAULT_ASSIST_CHIPS: { label: string; text: string }[] = [
  { label: "Add locations?", text: "Include useful locations or place suggestions." },
  { label: "Need roles?", text: "Add roles and responsibilities for the people involved." },
  { label: "Want a timeline?", text: "Turn this into a clear timeline." },
  { label: "Add deliverables?", text: "Include concrete deliverables and approval points." },
];

export function PromptStart({
  id,
  inputRef,
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
  rows = 2,
  highlight,
  projectMode,
  onProjectModeChange,
  onExample,
  onAssist,
  footer,
  className,
  extraTopSlot,
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
  projectMode: ProjectModeId | null;
  onProjectModeChange: (mode: ProjectModeId) => void;
  onExample: (prompt: string, mode?: ProjectModeId) => void;
  onAssist: (hint: string) => void;
  footer?: ReactNode;
  className?: string;
  extraTopSlot?: ReactNode;
}) {
  const selectedMode = projectModeById(projectMode);
  const promptExamples = selectedMode
    ? selectedMode.examples.map((prompt) => ({ prompt, mode: selectedMode.id }))
    : DEFAULT_EXAMPLES;
  const assistChips = selectedMode?.assistChips ?? DEFAULT_ASSIST_CHIPS;

  return (
    <PromptComposer
      id={id}
      ref={inputRef}
      className={className}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      disabled={disabled}
      autoFocus={autoFocus}
      rows={rows}
      highlight={highlight}
      placeholder={selectedMode?.placeholder ?? "Describe a rough idea, project, or plan."}
      theme="light"
      topSlot={
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PROJECT_MODES.map((mode) => {
              const picked = projectMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onProjectModeChange(mode.id)}
                  disabled={disabled}
                  className="font-body text-[11px] tracking-wide px-3 py-2 rounded transition-all disabled:opacity-30"
                  style={{
                    border: "1px solid",
                    borderColor: picked ? "rgba(0,0,0,0.34)" : "rgba(0,0,0,0.12)",
                    background: picked ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.7)",
                    color: picked ? "#17171a" : "rgba(23,23,26,0.68)",
                  }}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          {extraTopSlot}
        </div>
      }
      chips={
        <div className="flex flex-wrap gap-2">
          {value.trim().length === 0
            ? promptExamples.map((example) => (
                <button
                  key={`${example.mode ?? "free"}:${example.prompt}`}
                  type="button"
                  onClick={() => onExample(example.prompt, example.mode)}
                  disabled={disabled}
                  className="text-left text-[12px] sm:text-[13px] leading-snug px-3 py-2 rounded transition-all disabled:opacity-30 hover:bg-black/[0.035]"
                  style={{ border: "1px solid rgba(0,0,0,0.12)", background: "rgba(255,255,255,0.72)", color: "rgba(23,23,26,0.68)" }}
                >
                  {example.prompt}
                </button>
              ))
            : assistChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => onAssist(chip.text)}
                  disabled={disabled}
                  className="mono text-[10px] sm:text-[11px] tracking-widest px-3 py-2 rounded transition-opacity disabled:opacity-30"
                  style={{ border: "1px dashed rgba(0,0,0,0.18)", background: "transparent", color: "rgba(23,23,26,0.58)" }}
                >
                  {chip.label}
                </button>
              ))}
        </div>
      }
      footer={footer}
    />
  );
}
