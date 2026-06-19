"use client";

/**
 * Toggle — a standard on/off switch matching the app's pill aesthetic.
 * Used across Studio settings where a boolean choice is clearer than a button.
 */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left disabled:opacity-50"
    >
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="block text-[14px] text-white">{label}</span>}
          {hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-white/45">{hint}</span>}
        </span>
      )}
      <span
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "#fff" : "rgba(255,255,255,0.18)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
          style={{ left: checked ? 22 : 2, background: checked ? "#000" : "#fff" }}
        />
      </span>
    </button>
  );
}
