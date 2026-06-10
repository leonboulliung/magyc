# Motion & "Aliveness" — the transition strategy

How the whole app moves to one living language, in controlled steps,
without each screen reinventing its own feel.

## The one idea

> **The user's words are the through-line.** From the first keystroke to
> the published space, the same text the user wrote is the object that
> transforms — never a spinner, never a generic step. "Deine Idee wird
> greifbar" is communicated by *continuity of the thing itself*, not by
> a label that says so.

## Four motion primitives (the whole vocabulary)

Everything is built from these four. No screen invents a fifth.

1. **Carry** (`layoutId`) — one element persists across views and moves
   to its new home. The typed idea → the clarify quote → the space
   title are the *same* DOM element travelling. This is the spine.
2. **Settle** — things grow into place (opacity 0→1, y 6→0, easeOut).
   Already centralised in `lib/anim.ts`. Never bounce in the editorial
   register.
3. **Stagger** — a group lands in sequence (clarify questions, grid
   widgets, version dashes). Children inherit one container's timing.
4. **Pulse** — the only looping motion, reserved for "the system is
   thinking / alive" (the building dots, a live presence indicator).

If a new animation isn't one of these four, it's probably noise.

## Where it lives (single sources of truth)

- `lib/anim.ts` — every variant. Components import, never inline ad-hoc
  transitions. (Today ~half the variants are wired; finishing that is
  step 1 below.)
- `lib/style.ts` — the per-space palette/font as CSS vars. Motion reads
  the *same* tokens (`--v-accent` etc.) so movement is tinted by the
  space's own colour.
- One easing constant `[0.22, 1, 0.36, 1]` ("editorial ease") and one
  spring `{ stiffness: 400, damping: 20 }` (for tactile button feedback).
  Nothing else.

## The transition, screen by screen (rollout order)

**Stage 1 — Home choreography (the showcase).**
- `layoutId="idea"` on the textarea text → the clarify quote → (later)
  the space heading. The idea literally rises and condenses.
- Building screen: the input's words detach, drift, and skeleton widget
  outlines assemble from them. Replaces the dots for the *first* build.
- Soft hand-off into the space (fade/scale, not a hard route jump).

**Stage 2 — Space entrance.**
- Header settles, tags stagger, participants pop, grid widgets stagger
  in (already partly there via `bodyContainer`/`bodyItem`). Make the
  heading the *receiving* end of the home `layoutId`.

**Stage 3 — Element micro-interactions (per family, see ELEMENTS).**
- Vote/claim/check: the dot fills and the avatar *flies* from the actor
  to its slot (Carry). A confirmed realtime action from *another* user
  pulses once in their colour — that's how multiplayer feels alive.
- Add/remove: Settle in, scale-out on exit (AnimatePresence).
- Drag: pointer-follow (replace HTML5 drag), neighbours reflow with a
  layout transition.

**Stage 4 — Ambient life.**
- A faint presence indicator (who's here now, from the realtime
  channel). Pulse primitive. Optional, last.

## Guardrails (deliberately few)

- Respect `prefers-reduced-motion`: Carry/Settle/Stagger collapse to a
  fast fade; Pulse stops. One guard at the root, not per component.
- Durations: micro 0.15–0.2s, entrance 0.35–0.5s, choreography ≤ 1.2s.
  Nothing the user waits on.
- Motion never blocks input — it plays *around* an already-interactive UI.

## Definition of done

The app "feels like one thing" when: (a) every transition is one of the
four primitives, (b) the user's idea is visibly continuous from input to
title, (c) another person's action is visible the instant it happens,
and (d) turning on reduced-motion degrades gracefully everywhere from a
single switch.
