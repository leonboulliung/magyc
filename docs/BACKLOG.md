# Backlog — known issues & improvement queue

Prioritized. Each entry carries the root-cause analysis already done, so no
agent re-investigates from scratch. **Protocol:** pick from the top unless
Leon directs otherwise; move finished items to the Done section (one line,
date, commit); add new findings with enough context to act cold.

_Last updated: 2026-06-13 (Claude)_

---

## P1 — correctness

### 1. Stale SSR: space page serves cached data after edits
**Symptom (verified on prod):** edit the title → PUT 200, DB updated → reload
→ old title. **Root cause:** `app/s/[id]/page.tsx` fetches via supabase-js,
which uses `fetch` internally; Next 14 caches server `fetch` in the Data
Cache by default, and the project sets no `dynamic`/`revalidate` anywhere.
**Fix:** `export const dynamic = "force-dynamic"` in `app/s/[id]/page.tsx`.

### 2. Silent zero-row Supabase updates
`.update()` without `.select()` returns `{error: null}` even when 0 rows
matched — this masked bug #1 for days. **Fix:** chain `.select("id")` on the
updates in `app/api/spaces/[id]/widgets/[index]/route.ts`,
`…/widgets/route.ts` (PATCH/DELETE paths), `…/style/route.ts`; return 500
`update_no_match` on empty result.

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

### 5. Leaflet "Map container is already initialized"
Console error when a map widget re-mounts. **Fix:** init guard in
`components/widgets/MapCanvas.tsx` — destroy the existing map instance (or
bail) before re-init.

---

## P2 — product levers

### 6. Spaces too sparse ("only 2 widgets" problem)
Travel prompt yielded 2 body widgets. Stage-A scorer is told to be strict;
`MIN_SCORE = 5` + `MIN_BODY = 2` (lib/server/classify.ts) then produces bare
pages. **Plan:** log scores per request (one line), lower `MIN_SCORE` → 4,
raise `MIN_BODY` → 3, observe. Also consider a stronger model for Stage A —
scoring quality is the foundation of the page.

### 7. Streamed space creation (biggest perceived-speed win)
Today: 2 sequential OpenAI calls finish before redirect (~10-15 s wait).
**Plan:** after Stage A (~2 s) create the space with heading + pending
placeholders and redirect immediately; Stage B authors content and fills
widgets in, visible live. Turns the wait into a "magic build-up" moment.

### 8. Realtime sync for config changes
Config edits (title, poll options, style) reach other viewers only on manual
refresh — only `module_state` has a realtime channel. **Fix:** second
`postgres_changes` listener on `spaces` UPDATE in SpaceView; requires the
`spaces` table in the `supabase_realtime` publication (check Supabase
dashboard → Database → Replication).

### 9. Share loop: OG images + favicon
No favicon, no OG image — bare links. **Plan:** `@vercel/og` route rendering
title + space colors; favicon from `public/logo.png` /
`public/magyc-marble-2048x2048.png`.

### 10. Draft-loss protection
Owner token lives only in localStorage; cleared storage or another browser =
space lost. **Plan:** gentle "secure your space" nudge on draft spaces
(sign-in binds it via the existing publish path).

---

## P3 — infrastructure & hygiene

### 11. GitHub→Vercel webhook broken (no auto-deploy)
Deploys are manual (`vercel --prod --yes`). Try `vercel git connect` or
re-link the repo in the Vercel dashboard.

### 12. Rotate the Supabase service_role key
Flagged during an earlier session (key may have appeared in logs/context).
Rotate in Supabase dashboard → update Vercel env + `.env.local` → redeploy.

### 13. `module_state` unbounded growth
`SPACE_SELECT` loads ALL state rows; sketch strokes are up to 44 KB each.
Will hurt load time on active spaces. **Plan:** cap per-widget query +
lazy-load older rows; consider pruning superseded `edit` rows.

### 14. Rate limiting on /state
An anon token can insert unlimited rows. Add a cheap per-actor-per-space
counter (e.g. max N rows/min) before insert.

### 15. AI duplicate widgets
Classifier occasionally emits duplicate widget types in one space. Server
selection should de-dupe types outside the existing date/place groups.

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

- 2026-06-13 · P1 #1, #2, #5 fixed; classifier tuning (#6 first pass);
  realtime config sync (#8) — see commits following `3e694f3`.
- 2026-06-12 · Widget-state regression fixed (GridZone stale mirror) —
  `808bd22`. Security: owner tokens/password hashes no longer shipped to
  clients; published edits owner-only — `3e694f3`.
- 2026-06-11 · SSR space page, fra1 pinning, realtime instead of
  full-refetch — `d7a5655`, `8af9ebe`.
