/**
 * Motion variants — kept here so the animation language stays
 * consistent across views. Three principles:
 *
 *   1. Things grow into view rather than blink in.
 *   2. The hero (headline + synthesis) lands first; supporting
 *      modules stagger after with a 60–80ms gap.
 *   3. Easing favors `easeOut` — fast start, soft landing.
 *      Bouncy is wrong for the editorial register.
 */

import type { Variants } from "motion/react";

/** Used on the headline at the top of a space. */
export const heroIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/** The synthesis paragraph lands after the headline. */
export const synthesisIn: Variants = {
  hidden: { opacity: 0, y: 6 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.25 } },
};

/** Per-word stagger inside the synthesis. */
export const synthWordContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.3,
      staggerChildren: 0.022,
    },
  },
};

export const synthWord: Variants = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } },
};

/** The body modules (below the hero) come in staggered after the hero. */
export const bodyContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.65,
      staggerChildren: 0.07,
    },
  },
};

export const bodyItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/** Used for home-page stage transitions (input → clarify → building). */
export const stagePage: Variants = {
  hidden:  { opacity: 0, y: 6 },
  show:    { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.22, ease: "easeIn" } },
};

/** Clarify-question entrance — staggered down the page. */
export const clarifyContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.09,
    },
  },
};

export const clarifyItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/** Chip row on clarify steps — staggered after the slide-in completes. */
export const chipGrid: Variants = {
  hidden: {},
  show: { transition: { delayChildren: 0.28, staggerChildren: 0.065 } },
};

/** Version bar dashes appear with a quick stagger when a space loads. */
export const versionBarContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.4,
      staggerChildren: 0.04,
    },
  },
};

export const versionBarItem: Variants = {
  hidden: { opacity: 0, scaleX: 0.4 },
  show:   { opacity: 1, scaleX: 1, transition: { duration: 0.3, ease: "easeOut" } },
};

/**
 * Studio surfaces use motion as orientation: pages land softly, then
 * operational rows/cards follow with a restrained stagger. This keeps the
 * app feeling alive without making productive screens feel theatrical.
 */
export const studioPage: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
};

export const studioStagger: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.055,
    },
  },
};

export const studioItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
  },
};

export const studioRow: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
};

export const studioOverlay: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: "easeIn" } },
};

export const studioPanel: Variants = {
  hidden: { opacity: 0, x: 28 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.22, ease: "easeIn" },
  },
};

export const studioPopover: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.98,
    transition: { duration: 0.12, ease: "easeIn" },
  },
};
