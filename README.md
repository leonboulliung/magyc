# MAGYC

**From shoot idea to structured delivery.** MAGYC is a photographer-first
project workspace: a prompt or reusable Studio preset becomes a planning page
with the right modules for briefing, moodboard, shot list, locations, team,
deliverables, approvals, and client handoff. The same 33-module engine still
supports broader creative spaces, but the product direction is tuned for
commercial photography work: less prompt overhead, clearer collaboration,
cleaner delivery.

**Live:** https://magyc.site

## How it works

1. **Start from Studio or the home prompt.** A photographer can choose a preset
   or describe a shoot in natural language.
2. **Prepare the workspace.** Presets inject preconfigured modules and prompt
   rules; MAGYC may add contextual modules when the preset allows it.
3. **Build the plan.** A two-stage classifier scores all module types, the
   server deterministically selects, and the AI authors content in the input's
   language.
4. **Move through the lifecycle.** Studio projects use Planung / Auswahl /
   Abgeschlossen, with archiving, 30-day soft delete, sharing, and client-facing
   delivery surfaces.

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
- **Push = deploy.** Every push to `main` auto-deploys to production.
- **Typecheck gate:** `npx tsc --noEmit` must be clean before every commit.
- `/dev` is a showroom rendering all 33 widgets with fixtures.

## History

This codebase evolved out of an earlier Paris-only "one card per week" app;
its docs are preserved in `docs/archive/` for context only.
