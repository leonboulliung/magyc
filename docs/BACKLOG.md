# Backlog — known issues & improvement queue

Prioritized. Each entry carries the root-cause analysis already done, so no
agent re-investigates from scratch. **Protocol:** pick from the top unless
Leon directs otherwise; move finished items to the Done section (one line,
date, commit); add new findings with enough context to act cold.

_Last updated: 2026-06-13 (Claude, session 4)_

---

## P1 — correctness

### 3. Lost-update races on module config
Widget PUT does read-modify-write of the whole `modules` array with no
version check; reorder-PATCH ships the entire array from the client. Two
concurrent editors clobber each other. **Fix sketch:** add `modules_rev int`
to `spaces`; client sends the rev it saw; update with
`.eq("modules_rev", seen)` + increment; on 0 rows → 409 → client refreshes.

### 4. Claim race (slot double-booking)
`state/route.ts` checks "slot taken?" then inserts — two simultaneous claims
both win. **Fix:** partial unique index:
`CREATE UNIQUE INDEX ON module_state (space_id, module_index, (data->>'slotLabel')) WHERE kind = 'claim';`
then treat insert conflict as 409. (Manual SQL in Supabase editor.)

---

## P2 — product levers

### 6. Sparse spaces — observe the new tuning
First pass shipped 2026-06-13: `MIN_SCORE` 5→4, `MIN_BODY` 2→3, per-request
score logging (`[classify]` lines in Vercel function logs), and a body
de-dupe (one widget per type). **Next:** watch the logs against real
prompts; if pages are still bare, consider a stronger Stage-A model —
scoring quality is the foundation of the page.

### 7. Streamed space creation (biggest perceived-speed win)
Today: 2 sequential OpenAI calls finish before redirect (~10-15 s wait).
**Plan:** after Stage A (~2 s) create the space with heading + pending
placeholders and redirect immediately; Stage B authors content and fills
widgets in, visible live. Turns the wait into a "magic build-up" moment.

### 8. Realtime sync for config changes — broadcast shipped, pg_changes open
Shipped 2026-06-13: the saving client broadcasts `config` on the shared
channel; receivers refetch (debounced). Covers all UI-driven edits without
DB setup. **Open upgrade:** `postgres_changes` on `spaces` UPDATE would also
catch non-UI writes — needs `alter publication supabase_realtime add table
spaces;` run manually in the Supabase SQL editor (no migration runner).

### 9. Share loop: OG images + favicon
No favicon, no OG image — bare links. **Plan:** `@vercel/og` route rendering
title + space colors; favicon from `public/logo.png` /
`public/magyc-marble-2048x2048.png`.

### 9b. Editing the h1 doesn't update `spaces.title`
The heading widget edit only rewrites `modules[0]`; the `title` column
(browser tab, OG metadata, dashboards) keeps the AI's original. When a
heading at index 0 is saved, the widgets PUT should also set `title`.

### 10. Draft-loss protection
Owner token lives only in localStorage; cleared storage or another browser =
space lost. **Plan:** gentle "secure your space" nudge on draft spaces
(sign-in binds it via the existing publish path).

---


### 15. GIF widget needs Tenor or Giphy API key
`/api/gif` returns empty results because neither `TENOR_API_KEY` nor
`GIPHY_API_KEY` is set in Vercel env. Widget degrades gracefully (no crash,
search field shown, no results). **Fix:** add one of the keys in Vercel
dashboard → Settings → Environment Variables.

---

## P3 — infrastructure & hygiene

### 12. Local `.env.local` has stale/invalid Supabase keys
Verified 2026-06-13: both the anon and service_role keys in `.env.local`
are rejected by Supabase ("Invalid API key") while prod (Vercel env) works
— the keys were likely rotated and only Vercel updated. `vercel env pull`
returns empty values for sensitive vars, so Leon must copy the current
keys from the Supabase dashboard into `.env.local`. Until then, agents
cannot query the DB directly (prod API still works fine). The original
rotation concern (key may have appeared in logs/context) may thereby
already be resolved — confirm with Leon.

### 13. `module_state` unbounded growth
`SPACE_SELECT` loads ALL state rows; sketch strokes are up to 44 KB each.
Will hurt load time on active spaces. **Plan:** cap per-widget query +
lazy-load older rows; consider pruning superseded `edit` rows.

### 14. Rate limiting on /state
An anon token can insert unlimited rows. Add a cheap per-actor-per-space
counter (e.g. max N rows/min) before insert.

---

## Deferred (needs Leon)

- **answerType clarify rebuild** — discriminated union for clarify answers.
  Leon: "noch nicht."
- **Systematic 29-widget breadth test** — never completed; `/dev` showroom
  exists as the harness.
- **Pre-warm title alternatives + context-aware placeholders** on space load.
- See `TODO-LAUNCH.md` for launch-gated items (email digest, trust & safety,
  phone verification, emergent functions).

---

## Done

- 2026-06-13 · **Grid layout single-column bug fixed** (`0bfc02d`): CSS `columns-1
  sm:columns-2` + `break-inside:avoid` caused the columns algorithm to stack all
  widgets in column 1. Replaced with `grid grid-cols-1 sm:grid-cols-2 items-start`;
  full-width cells now use `gridColumn:"1/-1"` instead of `columnSpan:"all"`.
  Verified on prod: 6 widgets correctly spread across 2 columns.
- 2026-06-13 · **KI-Einschätzung microTitle HTML-tags stripped** (`c406776`):
  `sanitizeModule` `base()` now runs `stripTags()` on `microTitle` before
  storing — AI was returning `<SMALL LABEL IN DE> …</SMALL>` raw markup.
- 2026-06-13 · **KI-Einschätzung add-from-picker bug fixed** (`f3c3362`):
  `sanitizeModule` rejected `ai_summary` with empty text (required ≥ 5 chars),
  but the picker default is `text: ""`. Fixed: allow empty text + added
  `ai_summary` to `AI_FILL_ON_ADD` so it gets AI-authored immediately on add.
- 2026-06-13 · **Full module test on prod** (session 2): Checklist ✓, Work packages
  ✓, Standort/Map (zoom, no Leaflet errors) ✓, Phasen 1→4 ✓, Team claim ✓, Tags
  add ✓, Heading edit + reload persistence ✓, Style editor opens ✓.
- 2026-06-13 · **Widget test session 3** (partial): Notizen (note saved ✓),
  Wikipedia (article swap via URL ✓, attribution ✓), GIF (search UI ✓, no
  results due to missing API key — see #15), Symbol (AI fill = shopping cart ✓).
- 2026-06-13 · **Auto-deploy restored** (#11): `vercel git connect` re-linked
  the repo; pushes to `main` now build + promote automatically (verified).
- 2026-06-13 · **Stale-SSR bug** (root cause of "title not persisting"):
  `force-dynamic` on the space page was NOT enough — Vercel's Data Cache
  kept serving the supabase REST GETs; the actual fix is an explicit
  `cache:"no-store"` fetch on both supabase clients (`a28ccf6`).
  Verified end-to-end on prod: PUT title → 3 fresh reloads all show it.
  **Silent zero-row updates**: `.select("id")` guards on all spaces
  updates. **zod v4 API bug**: bare `z.unknown()` fields are required —
  any request omitting answers/style/widget got a 400 invalid_body; all
  rich-object fields now `.optional()` (`56771e0`). **Leaflet re-init
  crash**: run-token guard + container-stamp clear in MapCanvas.
  **Classifier first pass** (#6: MIN_SCORE 4, MIN_BODY 3, score logging
  — test prompt now yields 3 body widgets instead of 2) and **AI
  duplicate widgets** (de-dupe in assembly). **Config broadcast sync**
  (#8). — commits `25fc189`…`a28ccf6`.
- 2026-06-12 · Widget-state regression fixed (GridZone stale mirror) —
  `808bd22`. Security: owner tokens/password hashes no longer shipped to
  clients; published edits owner-only — `3e694f3`.
- 2026-06-11 · SSR space page, fra1 pinning, realtime instead of
  full-refetch — `d7a5655`, `8af9ebe`.
