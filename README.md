# MAGYC

**Drop an idea, get a living space.** MAGYC turns a few sentences of rough
intent into a structured, collaborative workspace — composed by AI from 29
widget types (maps, polls, checklists, timelines, crews, sketches, galleries,
discussions, …), themed to the idea's mood, editable in realtime with anyone
who has the link.

**Live:** https://magyc.site

## How it works

1. **Type an idea** on the home page — any language.
2. **Clarify** — the AI asks 2-4 typed follow-ups (choices, a location pin,
   phases, a date) only where they genuinely shape the result.
3. **Build** — a two-stage classifier scores all widget types against the
   input, the server deterministically selects, the AI authors content in the
   input's language and assigns a visual style (font + palette).
4. **Share the URL** — visitors vote, check, claim, write, and sketch without
   an account. Publishing (Clerk sign-in) binds the space to its owner.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Supabase
(Postgres + Realtime) · Clerk (email OTP) · OpenAI · Leaflet + CARTO ·
motion/react · dnd-kit · Radix UI · zod · Vercel (fra1).

## Working on this repo

**Agents and humans both: start with [AGENTS.md](AGENTS.md)** — the canonical
briefing (architecture, state model, workflows, conventions). The issue queue
lives in [docs/BACKLOG.md](docs/BACKLOG.md); the frozen data shapes in
[docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md).

Key facts up front:

- **No localhost flow.** Test against the Vercel deployment.
- **Manual deploys:** `vercel --prod --yes` (the GitHub webhook is broken).
- **Typecheck gate:** `npx tsc --noEmit` must be clean before every commit.
- `/dev` is a showroom rendering all 29 widgets with fixtures.

## History

This codebase evolved out of an earlier Paris-only "one card per week" app;
its docs are preserved in `docs/archive/` for context only.
