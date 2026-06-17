# Backlog — known issues & improvement queue

Prioritized. Each entry carries the root-cause analysis already done, so no
agent re-investigates from scratch. **Protocol:** pick from the top unless
Leon directs otherwise; move finished items to the Done section (one line,
date, commit); add new findings with enough context to act cold.

_Last updated: 2026-06-17 (Codex, studio navigation + preset UX correction)_

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

### 5. Studio settings: profile and contacts
Presets now have their own `/studio/presets` surface. Remaining Studio
settings should also be dedicated flows rather than dashboard clutter:
public profile settings (`profilname.magyc.site` later), focus tags (Mode,
Produktfotografie, …), profile description, and a lightweight directory for
team members and clients (user accounts). Product decision made: visible
project stages are **Planung / Auswahl / Abgeschlossen** while the current
DB enum remains `brief / production / handoff` until a deliberate migration
is worth it.

### 6. Error UX architecture
Current visible errors use Sonner toasts in selected flows, but the product
needs a deliberate error system: inline validation for fixable form errors,
toast/dialog treatment for recoverable action failures, and React error
boundaries for rendering failures. Candidate open-source pieces researched:
Sonner for action feedback and `react-error-boundary` for component fallbacks.

### 7. Sparse spaces — observe the new tuning
First pass shipped 2026-06-13: `MIN_SCORE` 5→4, `MIN_BODY` 2→3, per-request
score logging (`[classify]` lines in Vercel function logs), and a body
de-dupe (one widget per type). **Next:** watch the logs against real
prompts; if pages are still bare, consider a stronger Stage-A model —
scoring quality is the foundation of the page.

### 8. Streamed space creation (biggest perceived-speed win)
Today: 2 sequential OpenAI calls finish before redirect (~10-15 s wait).
**Plan:** after Stage A (~2 s) create the space with heading + pending
placeholders and redirect immediately; Stage B authors content and fills
widgets in, visible live. Turns the wait into a "magic build-up" moment.

### 9. Realtime sync for config changes — broadcast shipped, pg_changes open
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


### 15. Marketing site — fill the scaffold with real content (iterative)
The `(site)` route group + hybrid landing ship as a clickable **look & feel**
scaffold only (commit `3c0b50c`): every page uses placeholder copy and dashed
`MediaPlaceholder` boxes, on purpose. Leon's directive: bring it to a top
level **step by step**, no invented mediocre copy, no random stock images.
**Next, per page (in priority order):**
- `/for/[area]` (start with `photography`) — real promise, proof, creator
  quote, and real shoot imagery; then deepen the other four modes.
- `/showcase` — replace the 6 placeholders with real space previews (link
  to live `/s/...` examples once curated).
- `/how-it-works`, `/story` — real narrative.
- `/docs`, `/changelog` — port the real docs/contract + changelog content.
- `/contact` — wire the inert form (email/inbox); see also #9 OG + favicon.
- `/legal/{imprint,privacy,terms}` — **launch-blocking**: real, legally
  reviewed text covering the actual data flows (Clerk/Supabase/OpenAI/Vercel/
  Giphy/Wikipedia/Photon). Currently explicit placeholder disclaimers.
Possible additions Leon may want: Pricing/FAQ, newsletter capture, per-page
SEO/OG. Brand palette + primitives live in `lib/site.ts` and
`components/site/`.

### 16. Public home performance before acquisition traffic
The video/GSAP variant was removed after review; the public home now uses a
lighter CSS emergent backdrop and the build shows `/` at ~15.9 kB route size /
~190 kB first-load JS. Still check real Core Web Vitals on mobile before
acquisition traffic starts, especially because Clerk sign-in chrome remains
on the public nav.

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

- 2026-06-17 · **Studio navigation + preset UX correction**:
  added a quiet Studio sidebar for Studiobereich, Presets, Nutzer, Profil,
  and Einstellungen; removed the redundant dashboard preset CTA. Reworked
  `/studio/presets` from a card/form wall into a table-led preset overview
  with a registry-derived element pool, 27 available project elements, and
  per-element configuration controls for rows, locations, dates, titles, and
  notes instead of one generic text field per element. Placeholder pages now
  exist for users, profile, and settings so the sidebar is structurally stable.
- 2026-06-17 · **Preset builder + draft claim flow**:
  moved presets off the Studio dashboard into a dedicated `/studio/presets`
  page. The builder now supports creating/naming presets, assigning at least
  one element from the element pool, optional per-element default content, and
  optional prompt-injection text fields. Added `/api/spaces/[id]/claim` so
  anonymous homepage drafts can be saved privately into Studio after login
  instead of being forced through public `publish`.
- 2026-06-17 · **Studio settings slice 2**:
  added the first Studio settings surface for photographer workflows: editable
  local element presets, public profile draft fields, focus tags, and a small
  team/client directory. Also removed dead Studio/Projects header labels,
  centered the new-project plus icon, and made project row action menus open
  upward so all actions stay visible inside the table area. Persistence is local
  browser state for this slice; server-side account storage is still pending.
- 2026-06-17 · **Studio dashboard slice 1**:
  simplified the Studio project overview to one table-only view. Removed the
  cards/table toggle and the large "Neues Projekt" CTA from the shell header;
  the header now uses calmer typography and a visible "Abmelden" action next
  to the Clerk user button. Project creation moved to a compact `+` near the
  table. Every project row now has a required gear menu with open, share,
  duplicate, and delete actions. Presets, profile page, team/client management
  remain the next Studio settings slice.
- 2026-06-17 · **Iteration: account-project adds, visible errors, home consolidation, style simplification, studio overview**:
  fixed the real `invalid_body` root cause for Studio projects: Clerk-owned
  spaces have no anon owner token, but the client sent `anonOwnerToken: null`
  to schemas that accept only string/undefined. Added a shared client helper to
  omit null owner tokens, wired it through widget add, widget save, and style
  save, and added Sonner toasts for visible API failures. Consolidated the
  standalone gallery into the home page as a photographer-facing proof/work
  section and redirected `/showcase` to `/#work`; removed "Galerie" from nav
  and footer. Simplified style editing to font + accent and made workspace
  cards substantially more opaque/readable. Demo drafts now lead signed-out
  users toward account creation/saving instead of "Publish", and the draft
  footer no longer shows the obsolete public/private toggle. Studio dashboard
  now shows phase counts and cards/table view; duplicate "Neues Projekt" CTA
  removed from the dashboard body.
- 2026-06-17 · **Widget picker and marketing app-entry follow-up**:
  the first picker fix removed one nested scroll layer but kept the wrong
  interaction model: the full element library still opened as a small popover
  anchored to the plus button near the bottom of the workspace, so long lists
  were clipped and photography elements such as Moodboard felt missing. Rebuilt
  manual add as a viewport overlay portaled to `.vibe-root`, with one natural
  scroll area, photography-first ordering (Moodboard/Shotlist visible first),
  optimistic widget insertion, and explicit add errors. Also changed the
  marketing nav from a permanent "Anmelden" button to auth-aware actions:
  signed-out users can sign in with `/studio` as target; signed-in users see
  direct Studio / Neues Projekt links.
- 2026-06-17 · **Stability audit fixes: picker defaults, picker scroll, auth return**:
  root causes found during an architecture pass. Some manual add-widget entries
  posted invalid default configs (`appointments`, `locations_multi`,
  `location_suggestions`, `route`, `parts_list`) because the picker used empty
  arrays while `sanitizeModule()` requires at least one valid item/stop. The
  picker also had nested scroll containers (inner `WidgetPickerContent` plus
  popover/mobile sheet), making scroll feel sticky. Finally `/studio` redirected
  signed-out users to `/?next=/studio`, but the marketing `SignInButton` ignored
  that target, so users could authenticate and remain outside the app. Fixed
  defaults, moved scrolling to the owning container, and wired sign-in/sign-up
  redirect URLs to `/studio` or the safe `next` path. Follow-up risk: project
  APIs still duplicate owner checks instead of consistently reusing
  `isSpaceOwner`, and config writes still need the `modules_rev` fix in P1 #3.
- 2026-06-17 · **Photography specialty elements: Moodboard + Shotlist**:
  added first-class `moodboard` and `shot_list` widget types, renderers,
  sanitizers, picker entries, classifier authoring shapes, photo-shoot score
  bias, dev showroom fixtures, assistant context keys, and data contract
  version `1.3.0`. Existing widgets remain the preferred implementation for
  Briefing, Location Plan, Schedule, Team/Roles, Styling/Props, Gear,
  Deliverables, and Approvals to avoid duplicate functionality. Future product
  lever: preset builder / user presets.
- 2026-06-17 · **Wiki/GIF hidden from active creation**: removed `wikipedia` from
  AI scoring/authoring and removed both `wikipedia` and `gif` from the manual
  add-widget picker. Types/renderers remain for backward compatibility with old
  spaces that already contain them.
- 2026-06-16 · **Suite quick-wins: prompt-first builder + dup/delete** (`96a2a53`):
  builder is prompt-first (central prompt + quick-selects, optional Eckdaten,
  empty create allowed → starter project); `/api/projects` takes `prompt` and
  no longer requires fields; dashboard per-project Duplicate
  (`/api/projects/[id]/duplicate`) + Delete (`DELETE /api/projects/[id]`).
  Verified unauth boundaries (401/307). **Share for collaborators is next
  (Phase D)** — needs the private-project ACL.
- 2026-06-16 · **Creator-Suite foundation + brief core (Phase A)** (`4a6fb2d`):
  account-first suite (`/studio` dashboard, `/studio/new` guided product
  builder, `/studio/[id]` owner-gated workspace reusing SpaceView + stage
  stepper); `/api/projects` (create via classifier photo_shoot mode),
  `/api/projects/[id]` (PATCH stage); migration 010 (`spaces.stage`+`segment`,
  applied in Supabase); ownership unified (`isSpaceOwner`+`useIsOwner` honor a
  set `owner_id` via Clerk). Homepage demo untouched. Verified non-authed:
  `/studio`→307 Clerk sign-in (browser Accept), `/api/projects`→405,
  homepage/`/product`→200 (migration safe). **Open / next:**
  - "Brief schärfen" AI assist (refine brief from refs, propose shot list,
    flag ambiguities) — deferred, riskiest untested piece.
  - Signed-in flow needs Leon's manual test (no Clerk session available here).
  - Clerk is on a **dev** instance (`*.clerk.accounts.dev`); a production
    instance is needed before real launch.
  - Suite-draft privacy: `spaces` RLS is `select true` (public-by-id); real
    ACL for private projects is a later item. Add a nav entry into `/studio`.
- 2026-06-16 · **Marketing IA overhaul + 3 segments + pricing** (`59c524a`):
  Phase 1 — `SiteNav` responsive (white wordmark top-left, "Anwendungsfälle"
  desktop dropdown, mobile burger panel); new IA in `lib/site.ts` (`MAIN_NAV`,
  `USE_CASES`, Roadmap→footer, `LOCALES`); footer DE/EN switch placeholder;
  landing double-logo + italic fixed (marble wordmark removed, teaser German +
  font-brand, chips → segment routes; create flow untouched). Phase 2 — Event,
  Wedding, Fashion segments (message per bottleneck). Phase 3 — `/pricing`
  (Free/Pro/Studio, marketing-only). Captured `STRATEGY.md §12`: suite's primary
  creation path is a guided segment-first builder, prompt flow = homepage demo.
  Open: real imagery for Event/Wedding/Corporate work bands; Phase 4 polish of
  remaining (site) pages; Phase 5 i18n (/en) — switch goes live then; mobile
  burger needs a real on-device tap-test (Chrome MCP was down this session).
- 2026-06-16 · **Marketing redesign: bold brand type + real logo + gallery** (`0f5ecd2`):
  per Leon's "feels artificial / italic distracts / logo missing" feedback —
  headlines off italic serif → bold Space Grotesk (`font-brand`); deleted the
  pink brush `logo.png`, added white serif `magyc` wordmark top-left in a clean
  full-width top bar (replaced the floating pill); removed the animated
  EmergentBackdrop from segment pages; rebuilt `/showcase` as a real 10-image
  cross-segment masonry gallery (public/media/showcase-*). Open: Corporate has
  no real imagery yet (kept placeholders — provided set was event/wedding/
  editorial/product, no corporate); the landing `app/page.tsx`'s own teaser
  still uses the old italic style (app file, left untouched).
- 2026-06-16 · **Reusable segment landings + Corporate** (`588a488`):
  data-driven `Segment` model (`lib/segments.ts`) + one renderer
  (`SegmentLanding`); `/product` (real imagery) and `/corporate` (placeholders)
  are thin wrappers, interlinked, in a footer "Für" group. Message differs per
  bottleneck. STRATEGY.md §11 reworked to the staggered segment-page model
  (Product → Corporate → Event → Wedding). Open: corporate imagery; retire/
  redirect old generic `for/[area]` onto this model; Event/Wedding pages later.
- 2026-06-16 · **German /product landing + first real media** (`745cbc5`):
  translated `/product` to German + shared nav/footer; brought in BTS hero +
  6-image sample band (`public/media/`, via `SiteImage`). Present slot stays a
  placeholder (future Module-3 UI).
- 2026-06-16 · **Strategy compass + product-photographer landing** (`8307748`):
  added `docs/STRATEGY.md` (binding pivot strategy — "one engine, two intents",
  Commercial/Product beachhead, GenAI-anxiety positioning, 3-module product +
  first sellable slice, architecture verdict) and a target-group-specific
  marketing landing at `/product` in the dark/editorial design language. Fixed
  `NAV_LINKS` (old labels Gallery/Styles/API/Pricing/Blog pointed at mismatched
  routes). No application code touched. Open follow-ups: real creative imagery
  for `/product` media slots; the generic `for/[area]` IA no longer fits a
  single-segment beachhead; decide whether `/product` becomes the front door.
- 2026-06-15 · **Black video / liquid-glass restyle**:
  public MAGYC now uses Barlow + Instrument Serif + Dirtyline, black global
  canvas, liquid-glass primitives, a captured-frame boomerang video hero with
  GSAP parallax, pill nav (`Gallery`, `Styles`, `API`, `Pricing`, `Blog`),
  and a restyled first-screen prompt that preserves the existing create flow.
  Marketing palette moved to the same black/glass direction; `Sign in` opens
  Clerk instead of pointing normal users at `/admin`.
- 2026-06-15 · **Restyle correction pass**:
  removed the concrete plant/growth video and GSAP dependency, restored the
  real MAGYC logo in nav + hero, brought the scrollable example landscape and
  footer back below the prompt, and fixed the bottom CTA layer so it no longer
  loses clicks to the content underneath.
- 2026-06-15 · **Marketing-site scaffold (look & feel)** (`3c0b50c`):
  turned magyc.site into a full site without touching the create flow. New
  `app/(site)` route group with shared `SiteNav` + `SiteFooter` on a fixed
  brand theme (`lib/site.ts`), `MediaPlaceholder` + section primitives, and
  pages: showcase, `for/[area]` (5 modes, SSG), how-it-works, docs, story,
  changelog, roadmap, contact (inert form), legal/{imprint,privacy,terms}.
  Landing `/` is now the hybrid (nav + live-prompt hero + marketing teaser +
  footer on the input stage only). Placeholder copy/media on purpose —
  real content is tracked as open item #15. Verified click-through on prod.
- 2026-06-15 · **Persistent assistant MVP**:
  added a fixed Ask MAGYC dock on every Thing page plus
  `/api/spaces/[id]/assistant`. The assistant answers with full page context
  (title, original prompt, current elements), stays available after generation,
  rate-limits per actor, and logs chats as `assistant_chat` in `ai_events` for
  the admin backend. It intentionally proposes changes instead of silently
  mutating widgets; direct action execution is the next product step.
- 2026-06-15 · **AI observability + read-only admin MVP**:
  added `ai_events` and `admin_notes` migrations, best-effort AI event logging
  for clarify/classify/widget-regenerate flows, env-gated `/admin`, and setup
  notes in `docs/ADMIN_MVP.md`. The admin view shows users, recent spaces,
  anonymous actors, and recent AI logs without exposing destructive actions.
- 2026-06-15 · **Workflow objects for deliverables + approvals**:
  both widgets now behave as collaborative workflow objects instead of static
  cards. Deliverables support per-item status, due-date edits, and a single
  claimed owner; approvals support requested/approved flow, due cues, client vs
  internal audience tags, claimed ownership, and visible approver attribution.
  The photo-shoot authoring hints and regeneration prompts were updated to emit
  these richer shapes, and the contract bumped to `1.2.0`. Verified locally
  with `npm run build` and `npx tsc --noEmit`.
- 2026-06-15 · **Photographer workflow widgets**: added explicit
  `deliverables` and `approvals` widgets, plus seeded starter questions for
  `qa`. The dev showroom now demonstrates all three states (deliverable
  expectations, approval checkmarks, client answers), the classifier can score
  and author the new widget types, the photo-shoot project mode now biases
  toward deliverables / approvals / client questions, and the data contract
  bumped to `1.1.0` for the additive widget/interface expansion. Verified
  locally with `npm run build` and `npx tsc --noEmit`.
- 2026-06-15 · **Masonry gap fix**: GridZone now uses a masonry-style CSS
  grid instead of equal-height visual rows. Each widget cell measures its own
  rendered height via `ResizeObserver` and spans the matching number of tiny
  auto-rows; the parent grid runs with `gridAutoFlow: "row dense"`. This closes
  the vertical dead space that appeared under shorter cards beside taller ones
  while preserving the existing sortable grid flow. Verified locally with
  `npx tsc --noEmit` and `npm run build`.
- 2026-06-15 · **Photo-shoot authoring package**: selected `Photo shoot`
  now affects the actual build, not just the intake UI. Classifier scores get
  a deterministic shoot bias (shot list / references / prep / crew /
  deliverables-support widgets up, generic notes/discussion down). Authoring
  prompt now accepts project-mode shape hints, so `table` can land as a shot
  list, `images` as references, `checklist` as prep, `parts_list` as props /
  looks, `attachments` as brief-files, and collaboration/upload widgets can
  carry helpful placeholder/description cues. Verified locally with
  `npx tsc --noEmit` and `npm run build`.
- 2026-06-15 · **Guided intake package**: Home now has project-type chips
  (Photo shoot, Event, Trip, Campaign, Workshop), contextual example prompts,
  and in-flow "Add …?" chips that append useful structure while typing. The
  selected project type is passed to clarify/classify as UI context, so it can
  steer questions and widget scoring without overriding the user's input
  language. Home logo radius now matches the 20px element/input/Enter radius.
  Verified locally with `npx tsc --noEmit` and `npm run build`.
- 2026-06-13 · **Wikipedia "…" resolution bug + GIF picker rework** (`7b593e9`,
  `fc1b6d7`). Wikipedia (architectural, Leon-spotted): a freshly-added widget's
  placeholder topic "…" was resolved literally → the "Ellipsis/Auslassungspunkte"
  article. New `isResolvableTopic()` makes `resolveWikipedia`, `resolveExternalRefs`
  and the /resolve route skip placeholder/empty/punctuation-only topics, so the
  widget stays unconfigured and its picker (3 context suggestions + paste-URL →
  AI summary → click-through) shows. Verified on prod: add "…" widget → /resolve
  → `resolved:false`. GIF (Bild-4): roomy empty-state picker seeded with a short
  topic keyword from the title (the full title returns 0 gifs; first word
  "Flohmarkt" returns 12 — verified), clear language-matched placeholder, search
  on top; configured gif clipped to the card corners (was overflowing) and
  re-opens the picker on click (old change button collided with the unified
  toolbar). New `title` on WidgetContext. GIF visual check pending (Chrome MCP
  disconnected); seed term verified server-side.
- 2026-06-13 · **Element iteration 1: unified toolbar, AI-context, icon removal**
  (`403e6e0`). One toolbar per element — a per-cell `CellChromeContext` hands the
  reorder/resize/remove actions to WidgetShell, which renders them in the SAME
  pill as ✦ prompt / ↻ alternatives (was two separate floating clusters).
  Prompt box now has a clear, language-matched placeholder. AI-context: ✦ moved
  to a prominent bottom-right badge, text enlarged. Icon widget pulled from the
  picker + classifier (scoring + shape) + AI_FILL_ON_ADD (type/renderer kept for
  back-compat). Verified on prod: ai_summary bar = `⠿ ⇔ × ✦` (one pill), zero old
  `-top-2 -right-2` clusters, placeholder "Wie soll das geändert werden?", picker
  down to 25 (no Symbol). **Remaining from this feedback round:** GIF rework
  (bigger, topic suggestions, search field, fix re-select + corner overflow),
  Wikipedia rework (3 found options / custom link → AI summary → click-through).
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
