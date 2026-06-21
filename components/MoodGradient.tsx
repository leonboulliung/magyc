import type { CSSProperties } from "react";

/**
 * MoodGradient — a deterministic mesh gradient derived from a seed string.
 * Mood without content: every project/preset gets its own calm, layered
 * colour wash (a visual fingerprint), so the dark UI is a lit stage rather
 * than an empty void — and the same seed always renders the same gradient.
 *
 * Layered CSS radial-gradients over a near-black base; palettes are muted to
 * sit on the dark stage. Pure render (no client JS).
 */

// Curated, dark-stage-friendly palettes (soft, not garish).
const PALETTES: [string, string, string][] = [
  ["#3aa07a", "#7fcf9e", "#1e5b48"], // green
  ["#3a78d0", "#6fb3e8", "#20407a"], // blue
  ["#e07a5f", "#f2cc8f", "#9c4a36"], // sunset
  ["#7a5cd0", "#b39ae8", "#3a2a6e"], // purple
  ["#2fb3b3", "#8fe0e0", "#185a5a"], // teal
  ["#d0a23a", "#e8cf8f", "#6e5018"], // amber
  ["#d05c9a", "#e89ac0", "#6e2a50"], // pink
  ["#4c6fd0", "#9ab3e8", "#26356e"], // indigo
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function MoodGradient({
  seed,
  className,
  style,
}: {
  seed: string;
  className?: string;
  style?: CSSProperties;
}) {
  const h = hashSeed(seed || "magyc");
  const palette = PALETTES[h % PALETTES.length];
  const pos = (i: number) => 8 + ((h >>> (i * 4)) % 84); // 8..92

  const layers = [
    `radial-gradient(60% 60% at ${pos(1)}% ${pos(2)}%, ${palette[0]}cc, transparent 60%)`,
    `radial-gradient(55% 55% at ${pos(3)}% ${pos(4)}%, ${palette[1]}99, transparent 60%)`,
    `radial-gradient(65% 65% at ${pos(5)}% ${pos(6)}%, ${palette[2]}aa, transparent 62%)`,
  ];

  return (
    <div
      aria-hidden
      className={className}
      style={{ background: `${layers.join(", ")}, #0a0a0a`, ...style }}
    />
  );
}
