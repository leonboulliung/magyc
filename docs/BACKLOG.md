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

## Code-health review (session 4, 2026-06-13)

Full read-through for leanness / architecture / inconsistencies. #17, #19,
#21 fixed + verified on prod; #18 partially done. Remaining below.

### 18. Inline-edit hook adoption — finish the single-line editors
The `useInlineEdit` hook shipped (`components/widgets/useInlineEdit.ts`) and
Heading / AiSummary / RichText now use it (three `autoResize` copies gone).
**Remaining:** the single-line `<input>` editors that still hand-roll the
same draft/Enter/Escape/blur wiring — RangeRenderer, DateRenderer,
TableRenderer (cells), TagsRenderer, AppointmentRenderer/AppointmentsRenderer,
QaRenderer (ask/answer fields). Adopt the hook incrementally (mostly
`submitOn:"enter"`, no autoGrow); verify each widget edits after conversion.

### 20. `applyActionLocally` mirrors server state semantics
`lib/state.ts` re-implements the vote/check/claim dedup rules that
`state/route.ts` enforces server-side. AGENTS.md already warns "change one,
change the other" — a structural coupling hazard. **Fix (low-cost):**
co-locate the dedup keys / a shared spec so the two can't drift silently.

### 22. `app/page.tsx` is 668 lines (whole clarify flow inline)
The home component holds input + clarify steps + build orchestration in one
client file. **Fix (optional):** extract a `ClarifyFlow` component and the
step renderers; lowers cognitive load, no behaviour change.

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

- 2026-06-13 · **Mobile scroll fixes** (`1932bfa`): home page — the fixed
  full-screen landing still let mobile browsers rubber-band overscroll (phantom
  scrollbar; the canvas resized so the dot grid jumped). Lock html/body scroll
  while the page is mounted (restored on navigate), content column scrolls
  internally only if it overflows. Verified: html/body overflow hidden,
  document not scrollable, clean screenshot (no scrollbar). Space page — the
  style/publish controls auto-hid on scroll (earlier behaviour); per feedback
  they now simply stay fixed (verified: rect top constant across an 800px
  scroll, transform none). Side note: Chrome's CDP screenshot recovered in a
  fresh tab — the earlier timeouts were degraded tab state from many synthetic
  pointer events, not a page bug.
- 2026-06-13 · **Sketch tools + reorder snap-back fix** (`cb46c32`, `715ab5d`,
  `442258c`). (1) Reorder: the grid rendered straight from props so a dropped
  widget snapped back then the new order appeared abruptly after the round-trip;
  GridZone now holds an optimistic order on drop and reconciles on the refetch.
  (2) Sketch rebuilt: pen, eraser, line, rect, ellipse, text + colour palette +
  3 sizes + a full-screen editor (⤢). Marks are still `stroke` actions, data now
  a tagged union (path|erase|line|rect|ellipse|text), back-compat. State route
  accepts the new shapes; `makeOptimisticEntry` keeps an explicit colour. Fixed
  a bug where `setPointerCapture` could throw and abort a draw (now try/catch),
  and a duplicate dotgrid pattern id (now useId per canvas). Verified
  functionally on prod: pen/eraser/rect/ellipse/text all commit + persist (no
  rollback), expand opens the editor. NOTE: Chrome's CDP `captureScreenshot`
  degraded mid-session (times out on every page incl. ones that worked earlier
  with identical code) — verification done via DOM/network checks, no
  screenshots. Test scribbles were left on space 9Pyr3MMAcZ's sketch (no
  server-side stroke delete exists; clear is visual-only).
- 2026-06-13 · **UI polish round 3** (`d2b15b1`, `0297b9b`): from Leon's feedback.
  (1) Drag distortion — SortableCell used `CSS.Transform`, whose sortable value
  carries scaleX/scaleY to morph the dragged card into the target slot's size,
  squashing variable-height widgets. Switched to `CSS.Translate` (translation
  only) + `MeasuringStrategy.Always`. Verified: mid-drag transform is
  `matrix(1,0,0,1,0,240)` — pure translate, no scale. (2) Bare-widget titles —
  media widgets (map, sketch, images, gif, route, locations) use WidgetCard
  `bare` (no padding), so microTitles sat flush in the rounded corner; in bare
  mode title/footer now get their own px-4 inset. Verified: map titles now
  paddingLeft/Top 16px. (3) Build message — clarify returns an AI-authored,
  language-matched `comingToLife` line; the building screen shows it as a
  specific sentence ("Dein Spieleabend mit Freunden wird …") instead of cycling
  raw keywords (kept as fallback). Verified via clarify API.
- 2026-06-13 · **Ambient DotField + prompt overflow fix** (`212a7af`): from Leon's
  feedback. DotField no longer races a wavefront from one point — the whole
  lattice breathes via interfering drifting sine layers (soft regions emerge /
  merge / equalise, no origin); ripple() = brief energy surge, setThinking() =
  sustained livelier field. Reduced-motion → one static frame; pauses on hidden
  tab. Prompt box: the auto-grow textarea pushed its own bottom (+ Enter key) off
  the fixed, overflow-hidden page — long text became unreachable on mobile. Now
  caps at ~40vh then scrolls internally (verified: 30-line input → 281px box,
  overflowY auto, scrollable). **Note:** could not exercise a true mobile
  viewport via Chrome automation (forced ~1280px); fix verified functionally +
  on desktop.
- 2026-06-13 · **UI polish round 2** (`93e4083`): from Leon's feedback. (1) Grid
  clipping — CSS multi-column masonry split tall widgets across the column
  boundary; switched to CSS grid (`grid-cols-1 sm:grid-cols-2`, `items-start`,
  full-width via `gridColumn:1/-1`). (2) Owner chrome redesigned — the
  drag/resize/remove tabs sat at negative offsets poking square backgrounds out
  of the rounded corners and were tiny; now one rounded pill tucked inside the
  top-right corner, 28px buttons, blur+shadow; resize hidden on mobile. (3) Home
  — logo ~halved (h-26/30), prompt box auto-grows with content. (4) Clock emoji
  ⏱ → monochrome ◷ (appointment widget, range time unit, picker). (5) MobileSheet
  drag-to-dismiss via the grab handle (`useDragControls`, handle-only so body
  scroll isn't hijacked). Verified on prod desktop: grid no-clip, owner pill,
  logo+growing input, ◷ present / ⏱ gone. **Pending:** the sheet drag-down
  GESTURE couldn't be exercised via Chrome automation (forced 1280px viewport,
  no real touch) — tap/backdrop close were verified earlier; drag needs a
  real-device check.
- 2026-06-13 · **Code-health review fixes** (`2fe97e0`, `121e43c`): #17 owner-auth
  centralized in `lib/api/auth.ts` (`isSpaceOwner` + `forbidden`), adopted by the
  widgets / widgets[index] / style routes — verified on prod (wrong token → 403,
  owner token → 200 add+delete). #21 `/dev` now `notFound()` in production. #19
  `newLocalId(prefix)` in `lib/id.ts` replaces 3 `Math.random()` copies. #18 shared
  `useInlineEdit` hook (Heading, AiSummary, RichText) — 3 `autoResize` copies + ~120
  lines of edit wiring removed; remaining single-line editors tracked in #18.
- 2026-06-13 · **MobileSheet portal fix** (`4cc4075`): the bottom sheet is spawned
  from inside transformed ancestors (scroll-hiding toolbar, motion/dnd-kit grid
  wrappers), which become the containing block for `position:fixed` and anchored
  the sheet top-right. Portaled into `.vibe-root` (themed, un-transformed). Verified
  on prod at 606px: style + picker sheets sit at the bottom, full-width.
- 2026-06-13 · **Mobile UX pass** (`60d6792`): new `MobileSheet` (full-width
  bottom sheet) for the StyleEditor and the add-widget picker on phones;
  floating top controls get more h1 clearance (pt-20) and slide away on
  downward scroll; new `useIsMobile` hook; picker tap targets enlarged.
  Visual prod verification at phone width still pending (Chrome MCP was
  disconnected at session end).
- 2026-06-13 · **Grid layout single-column bug fixed** (`0bfc02d`): CSS `columns-1
  sm:columns-2` + `break-inside:avoid` caused the columns algorithm to stack all
  widgets in column 1. Replaced with `grid grid-cols-1 sm:grid-cols-2 items-start`;
  full-width cells now use `gridColumn:"1/-1"` instead of `columnSpan:"all"`.
  Verified on prod: 6 widgets correctly spread across 2 columns.
- 2026-06-13 · **GIF widget live** (#15): `GIPHY_API_KEY` added to Vercel env
  by Leon; redeploy (`5d5d848`) picked it up (edge runtime needs a fresh build).
  Verified: `/api/gif?q=party` returns real Giphy results.
- 2026-06-13 · **Widget test session 4** — all 29 types now on prod space
  9Pyr3MMAcZ, no crashes. Interactive: Poll vote toggle ✓, Aufgaben checklist
  check ✓, Von-Bis 08:00→18:00 saved ✓. New batch (session 4): Diskussion,
  Ortsvorschläge, Route, Tabelle (A/B/C + row/col controls), Utensilien, Anhänge,
  Bilder, Audio, Skizze (blank canvas) — all render correctly. KI-Einschätzung
  microTitle fix verified: stripTags runs on read path via db.ts sanitizeModules,
  cleans existing dirty values retroactively.
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
