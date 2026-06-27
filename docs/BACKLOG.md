# Backlog — known issues & improvement queue

Prioritized. Each entry carries the root-cause analysis already done, so no
agent re-investigates from scratch. **Protocol:** pick from the top unless
Leon directs otherwise; move finished items to the Done section (one line,
date, commit); add new findings with enough context to act cold.

_Last updated: 2026-06-27 (Codex — authorized reads and Realtime cutover)_

---

## TODO — next operational step

- [ ] **Apply migration 024**
  (`supabase/migrations/024_state_compaction_and_admin_rollups.sql`) in the
  production Supabase SQL editor. Then run its verification query and
  `npm run ops:backup-check`. Until this is applied, the deployed application
  remains migration-tolerant, but repeated edits are not compacted and Admin
  activity counters fall back to bounded visible history.
- [ ] **After 024 and production role QA, apply migration 025**
  (`supabase/migrations/025_private_project_reads.sql`). It removes historical
  public project/profile SELECT policies and the old row-change publication.
  Code deployment `fb8deac` passed the production smoke suite: public snapshot
  reads work and private/synthetic ids are concealed as JSON 404. The
  authenticated owner/editor/client matrix is still required. Repeat it and
  the policy verification immediately after applying 025.

## Open engineering priorities

1. **Private-read cutover is code-complete; migration/QA remains.** Browser and
   SSR project reads now use role-gated snapshot APIs, and Realtime transports
   only data-free invalidations. Migration 025 performs the database lockdown
   after the production role matrix passes. Private Broadcast channel auth and
   sequence-based reconnect recovery remain defense-in-depth upgrades.
2. **Integration and multi-user test harness.** Automated role-policy, snapshot
   client, deterministic state/preset/facts tests, and a production smoke script
   are present. Authenticated owner/editor/client, Storage, contract signing,
   and reconnect tests still require dedicated Clerk test accounts plus a
   disposable Supabase project or production-safe fixtures.
3. **Production role-matrix acceptance test.** After migrations 022-024 are
   confirmed, run one owner/editor/client project through preset creation,
   media upload/removal, concurrent editing, Auswahl, contract release/signing,
   Abschluss, archive, and Admin inspection. This is QA/operations rather than
   new feature development, but it is launch-critical.

Everything else currently listed below is a product/performance option rather
than unfinished work from the hardening package: streamed project creation,
anonymous draft recovery, deeper marketing content/SEO, and broader error-copy
cleanup can be prioritized from real usage.

---

## Done 2026-06-27 — state, admin and projection hardening

- Upgraded the application to patched Next.js 15 and PostCSS releases; all
  dynamic page/API parameters now follow the asynchronous Next.js contract.
  Added Vitest and deterministic coverage for collaborative state, preset
  remapping/sanitization, error translation, state limits, and ProjectFacts.
- Added migration 024. Repeated item edits are transactionally compacted,
  append-heavy module state has explicit ceilings, removed uploads delete their
  private Storage object, and direct uploads enter optimistic UI immediately.
- Replaced the Admin's fixed user/project snapshots with Clerk-backed search and
  pagination plus exact per-page database activity rollups. Abschluss and Admin
  inspection now share the deterministic ProjectFacts projection, including
  live edits/deletions instead of stale initial values.
- Documented the remaining strict-privacy architecture in
  `docs/REALTIME_SECURITY_PLAN.md`. Public-read RLS cannot be removed safely
  until direct anon reads and `postgres_changes` are replaced by a scoped,
  role-gated transport.

---

## Done 2026-06-27 — dashboard summaries and project roles

- Added migration 023 with first-class `project_members`, role indexes,
  `spaces.updated_at`, and a service-role-only Studio summary RPC. Dashboard
  cards now include real last activity, uploads, collaborators and the viewer's
  role without loading complete project graphs.
- Added owner-managed Team/Kunde project access. Editors can configure an open
  Planung and use AI editing; clients can interact, upload, view/sign contracts
  and follow project phases. Lifecycle, sharing, contract administration,
  archive/delete and member administration remain owner-only. Pending email
  invitations bind automatically when the matching Clerk account signs in.
- Remaining security hardening is explicit: historical public-read RLS on
  `spaces`/`module_state` is still required by the anon-client renderer and must
  later be replaced by scoped database authorization for strict private-data
  guarantees.

---

## Done 2026-06-27 — first-class preset state and assets

- Added migration 022 and a sanitized `studio_presets.template_state` plane.
  The Preset editor now feeds real state into `WidgetDispatcher`; all widget
  actions can be preconfigured without lossy per-element translation code.
- Preset media now uploads into an owner-scoped private Storage namespace,
  uses signed reads in the preview, and is garbage-collected when removed.
- `/api/projects` resolves account presets server-side by id. It maps template
  state to the classifier's final module indexes, remaps cross-entry ids,
  copies media into the new project namespace, inserts real `module_state`,
  and rolls the project back if materialization is incomplete.

---

## Done 2026-06-26 — audit hardening pass

- Added `lib/projectFacts.ts`, a deterministic projection from `modules` +
  `module_state` into reusable project facts. Contract drafting now consumes
  those facts, so live additions/edits for deliverables, approvals, checklist,
  moodboard, shotlist, uploads, selection state, Q&A, notes and parts can flow
  into the generated review draft.
- Added `/admin/spaces/[id]`, an admin-only read route for private projects.
  Admin project/timeline/support links now point there instead of `/s/[id]`, so
  the cockpit no longer depends on public/share visibility for inspection.
- Added a lean Studio project-list query (`fetchSpaceListByOwner`) and moved
  `/studio` onto it. Full module/state/version graphs are now reserved for
  opening one project, not rendering the project list.

---

## ⇨ AUDIT FINDINGS (2026-06-26) — MVP readiness blockers

**Status:** the core project creation path is no longer a mock. Home + Studio
share `PromptStart`; `/api/projects` and `/api/spaces` both carry presets,
clarification answers, prompt injections and the `allow_context_modules` flag
into the classifier. Signed upload infrastructure is also real. The remaining
MVP risks are not the first prompt, but the later projection layers.

1. **Contract facts were too narrow.** `ProjectFacts` now merges modules +
   module_state and feeds contract drafting, Abschluss, and Admin inspection.
   Edited/deleted notes, equipment, uploads, deliverables and other live state
   are projected consistently. Expand legal/product wording only when real
   customer projects expose concrete missing fields.
2. **Preset state/assets are now first-class.** Migration 022 adds the template
   state plane; media is owner-scoped and copied into projects, while state is
   remapped into real module indexes. Remaining validation is production UX
   testing after migration 022 is applied, especially upload-heavy presets.
3. **Admin cockpit is functional and paginated.** Plan/status/support actions
   are real, project links use admin-only read routes, Clerk supplies searchable
   account pages, and migration 024 supplies exact per-account activity totals.
   Admin contract inspection remains optional until support work demonstrates a
   concrete need.
4. **Studio dashboard metrics are now RPC-backed.** Migration 023 returns lean
   counts, last activity and access role for owned/member projects.
5. **Multi-user collaboration now has account membership.** Migration 023 adds
   Team/Kunde roles alongside the existing share-link path. Remaining launch
   validation: apply the migration and test one owner/editor/client trio in
   production, including uploads, contract visibility and signature boundaries.

---

## ⇨ HANDOFF (2026-06-23) — read this first

Working tree clean, everything pushed (HEAD `2fe6681`). Context for whoever
continues:

**Migrations applied by Leon (016 + 017):** `spaces.handoff` jsonb, and
`project_messages` table. Both code paths are migration-tolerant either way.

**Done this session:**
- **#4 Prompt→Element architecture** (`lib/server/classify.ts`): Stage A now
  also returns `explicit` types (user named concrete content) → forced into the
  page past the score cap (`selectModuleTypes(scores, forced)`, `HARD_MAX=8`).
  Stage B authoring rule flipped from "never placeholder" to GROUNDING
  (seed only from real input; else leave empty + placeholder, never fabricate).
- **#6 Absegnung/Abschluss as views** (`components/studio/StudioWorkspace.tsx`):
  forward-only stage bar; Planung/Absegnung/Abschluss switch the *view*; the
  contract is embedded (`ContractView embedded`), the Abschluss view is
  `AbschlussPanel` (closing note + links, client sees it via the share link).
- **#7 Signature toggle**: photographer can draw a signature (`SignaturePad`) +
  place, or click-consent. Stored in the contract `signers[]`.
- **#1 Fast-Prompt colours**, **#2 compact Preset pop-up** (`PresetBuilder`).
- **#5 @magyc chat** (the agent):
  - Stage 1: persistent thread `project_messages` + @magyc/Team channel switch
    (`AssistantDock`, `app/api/spaces/[id]/messages/route.ts`).
  - Stage 2+3: **streaming + tools** via Vercel AI SDK (`ai@6`, `@ai-sdk/openai`)
    in `app/api/spaces/[id]/assistant/route.ts`. Full project context incl.
    lifecycle stage; system prompt forbids JSON dumps; tool `addElement` (owner +
    open project only; restricted to sanitize-safe empty types). Dock refreshes
    the page after a turn.
- **Light theme** rebuild (decision: **"Bühne bleibt dunkel"** — SpaceView +
  project widgets + the @magyc dock on the stage stay dark; ALL other chrome is
  light). Done: account area, Studio shell/home/nav, Vertrag/Abschluss, dialogs,
  logo/favicon. `PromptComposer` gained a `theme: "light" | "dark"` prop to
  decouple marketing (dark) from Studio (light).

**Marketing light transition — done (Codex, 2026-06-23):** home was reduced to
the shared light app surface: off-white base, subtle DotField, light SiteNav,
light PromptComposer, no old showcase/footer marketing blocks. The creation
flow (clarify/building) now uses the same light language, and global html/body
defaults are light while the project stage remains locally dark.
Follow-up done 2026-06-24: pricing and segment landing pages now use the same
light brand tokens instead of leftover dark `text-white`/`bg-black` section
styling.
Follow-up done 2026-06-24: Home and Studio now share the same prompt controls
(`PromptStart`) and both run prompt → clarify → build. Studio keeps its
account-specific layer (presets, fast prompts, owner binding through
`/api/projects`) but no longer bypasses the clarification architecture.
Follow-up done 2026-06-25: `PromptStart` is now the actual single source of
truth for the Home + Studio prompt composer: German preset chips, German
Schnellbausteine, shared sizing/placeholder/submit controls. The old
marketing-only English project-mode/example chips were removed. Anonymous
Home creation now sends selected preset modules/rules through `/api/spaces`,
matching the Studio `/api/projects` contract.
Follow-up done 2026-06-25: Marketing now uses explicit photographer starter
presets (`MARKETING_STARTER_PRESETS`: Produktshooting, Hochzeit,
Business-Portrait, Event-Reportage) plus German fast prompts aimed at the
German photography market. Studio no longer falls back to those code presets:
signed-in users only see real account presets (or none).
Follow-up done 2026-06-25: Studio/Home prompt copy now uses the photographer
briefing language ("Plane deinen nächsten Fotografie-Auftrag") and the
clarify skip control switches between "Alle überspringen" and "Überspringen"
depending on whether partial answers already exist. Project actions are always
visible for active/archived/deleted contexts; active and archived projects can
be renamed through the existing PATCH route.
Follow-up done 2026-06-25: Preset editing removed the unused short description
field and now configures one selected element at a time via a mini project
preview that renders the real widget through `WidgetDispatcher`. Element chips
reuse the picker symbols and can be selected/removed like tags. The picker
still does not persist real uploaded preset assets as first-class preset media;
that remains a future data-model decision if Leon wants media templates.
Follow-up done 2026-06-25: "Fast-Prompts" is now user-facing
"Schnellbausteine"; colour swatches were reduced to a calmer palette. Clerk is
partly consolidated into Studio chrome: the topbar avatar links to the profile
page and the profile page can update the Clerk profile image. Full account
security/email management remains Clerk-owned unless a later slice rebuilds it.

**Infra audit 2026-06-25 (Codex):** the current Vercel + Supabase + Clerk +
OpenAI stack is enough for an early 100-user launch, but the highest-risk path
is media. Uploads still proxy through `/api/spaces/[id]/upload`, so the client
compresses to stay below Vercel's ~4.5 MB request limit even though the server
route documents 50 MB. For a photography product this must become direct
browser upload via signed upload URLs (or a dedicated object store) before
real customers move larger moodboard/reference/delivery files through MAGYC.
The `space_assets` bucket is public-read today, which is convenient but weak
for client/private work; move to private objects + signed download URLs for
customer-facing media. Realtime collaboration is architecturally sound for MVP
(`module_state`, Realtime, optimistic client, claim unique index), but free/pro
Supabase connection/message limits must be monitored as every open project tab
joins a Realtime channel. API abuse protection is currently mostly in-memory
(`state`, `upload`, `spaces`, `assistant`), so the next stability slice should
add persistent account/project/IP rate limits for AI + uploads, per-account
storage quotas, and admin visibility for upload/storage usage.
Follow-up done 2026-06-25: media infrastructure moved to signed direct
Supabase Storage uploads. `/api/spaces/[id]/upload` now prepares signed upload
tokens and commits upload state after the browser uploads directly to Storage;
`/api/spaces/[id]/assets/sign` signs private object paths for renderers. Upload
renderers resolve both legacy `url` rows and new private `path` rows. Migration
019 makes `space_assets` private and adds persistent rate-limit/usage functions
used by uploads, asset signing, state writes, create/classify, clarify,
regenerate, project create, and @magyc chat. **Operational follow-up:** apply
`supabase/migrations/019_asset_security_and_rate_limits.sql` in Supabase before
or immediately with deploy; monitor Storage usage and consider a dedicated
media CDN/R2 layer once delivery files or very large galleries become core.

Follow-up done 2026-06-25: element robustness pass. The grid-level two-column
resize affordance was removed for all widgets; element-specific fullscreen
remains only where the renderer owns it (e.g. Moodboard). Moodboard, Shotlist,
Questions, Poll, Notes, Attachments, Images/Selection/Audio uploads, Checklist,
Deliverables, Approvals, and Parts List now use clearer German empty states and
add actions instead of cryptic `…` / bare `+` affordances where they caused
confusion. The shared `UploadZone` now exposes one accepted-types/max-size
contract (50 MB per file), validates MIME/extensions client-side, normalizes
common blank browser MIME values, and matches the server allowlist for legacy
Office files. Attachments gained per-file download actions. Notes and inline
text paths now force wrapping (`overflow-wrap:anywhere`) to resist long input.
The user-facing Discussion element is retired from picker, presets,
classification, and `/dev`; the legacy `discussion` module type/renderer stays
only to avoid breaking existing Spaces under the frozen data contract.

Follow-up done 2026-06-26: operations foundation. Contract version bumped to
1.6.0 and migration `020_operations_foundation.sql` adds
`spaces.contract_version`, `app_events`, upload usage rollups, and a manual
ops migration log. Space inserts and reads are migration-tolerant if the deploy
lands before SQL. Storage calls now route through `lib/server/storage.ts`;
upload preparation/completion and asset signing write best-effort app events
through `lib/server/observability.ts`. `/admin` now shows contract version,
feature flags, media usage, operations logs, and existing AI logs. Added
`docs/OPERATIONS.md` and `npm run ops:backup-check` for non-destructive
production/staging readiness checks. **Operational follow-up:** apply migration
020 in Supabase and run the backup check against the production env.

Follow-up done 2026-06-26: admin/support launch cockpit. Migration
`021_admin_support_and_account_ops.sql` adds profile plan/account-status
fields, `support_tickets`, and `admin_audit_events`. `/admin` now shows launch
metrics, open support tickets, Clerk-enriched user emails, plan/status controls
with Clerk lock/ban/unlock integration, admin notes, and a read-only account
view with projects, tickets, and timeline. Signed-in users can submit one-way
support tickets from Studio and project pages; admins mark them done and reply
manually by email. **Operational follow-up:** apply migration 021 in Supabase
before using account controls/support in production.

**Done 2026-06-24:** module structural writes now use `spaces.modules_rev`
optimistic concurrency (`018_modules_rev_claim_guard.sql`, widget APIs, client
payloads) so stale tabs get a 409 instead of silently overwriting each other.
Claim races are guarded with a partial unique index plus insert-conflict
handling, and `/state` has a cheap per-space/actor write limiter. @magyc can
now add, remove and rename elements with the same module revision guard.
Follow-up done 2026-06-24: space reads and widget/assistant structural writes
fall back gracefully when a deploy reaches an environment before migration 018
has added `modules_rev`; project generation should no longer turn that schema
lag into `/studio/[id]` or `/s/[id]` 404s. The migration is still required for
real optimistic concurrency.
Visible stage language is now **Planung / Auswahl / Abgeschlossen** while DB
ids stay `brief / production / handoff`.

**Other open follow-ups:** @magyc still needs deeper content-edit/fill tools
(not just structural add/remove/rename); Next.js advisories (`npm audit` →
would need a Next 16 major upgrade, deliberately deferred); Konnektoren is
still an honest "in preparation" page; multi-seat team invites on the Nutzer
page.

---

## Studio QA — 2026-06-18 (Leon, live test from his account)

Triaged from a full QA pass. Grouped by severity. **Heart of the app = the
elements**, so the correctness bugs there come first.

### Q1 — ✅ FIXED: state bleeds across widgets (data integrity)
Uploads made in one widget reappeared in another after delete/reorder.
**Root cause:** `module_state` is keyed by positional `module_index`; the
delete/reorder routes didn't touch state, so rows orphaned onto whatever
widget slid into the slot. **Fix (option a):** widget DELETE now drops the
removed module's state rows + shifts higher indices down; reorder PATCH takes
an `order` permutation from the client and remaps state via a two-phase offset
(`app/api/spaces/[id]/widgets/route.ts`, `components/GridZone.tsx`). Durable
option (b) — stable module ids — no longer urgent; keep as a nice-to-have.

### Q2 — ✅ FIXED: actor shows "?" / "anon" even when signed-in owner
**Root cause:** `getSelfId()` always returned the anon token (so "is mine?" +
realtime dedupe mismatched the server's Clerk actor id), and `/state` stored
`display_name` only from the empty `anonName`. **Fix:** `lib/state.ts` now has
a signed-in identity bridge (`setSelfUser`, set by `SpaceView` from the Clerk
user) feeding `getSelfId`/`getMyColor`/optimistic actor; `/state` + `/upload`
resolve `display_name` from the profile for signed-in contributors.

### Q3 — Element bugs (Herzstück) — ✅ done
✅ Done (commits `10b3468`, `fd7f0bb`, `c2b00f9`): Poll/Crew/WorkPackages now
owner-configurable (inline edit + add/remove via shared `InlineText`);
Notes + Q&A entries deletable (soft-delete via `edit{deleted}`); Phases is a
vertical timeline showing all phases; Attachments reworked (grouped by kind,
image thumbnails, per-file remove).
✅ Done (commit `dda82d2`): **Shotlist** add field stays open after Enter for
rapid multi-add + per-shot remove (soft-delete + deleted-filter). **Moodboard**
per-image click-to-edit caption (`edit{id,caption}`) + per-image remove
(`edit{id,deleted}`), uniform 2/3-col grid (was hero span), directions get
multi-add + per-row remove. **Images** large-set reads cleanly in the 2-col
grid (placeholder + radius already done in Q4).
✅ **Selection↔Moodboard — decided: keep separate, do NOT merge.** They look
alike (both image grids) but serve different lifecycle stages: Moodboard =
*pre-shoot* references + direction tags (ref/ok/no-go) + per-image notes;
Selection = *post-shoot* proofing (favorite/select + per-photo comments on a
photographer-provided set). Same visual language is intentional; the verbs
differ. No code change.

#### Original Q3 list
- **Moodboard:** images overflow the border-radius (missing overflow-hidden on
  the rounded frame); support MORE images + per-image text notes (not only the
  separate direction list). The no-go/ref/ok toggle is good — keep.
- **Shotlist:** adding new entries is confusing and too slow. Streamline the
  add UX (inline, fast).
- **Images:** no placeholder when empty; border-radius overflow; unclear/safe
  behaviour for LARGE sets (how it looks + scrolls); plus the Q1 bleed.
- **Selection:** same border-radius overflow + Q1 bleed. NOTE: selection ≈
  moodboard after Leon's changes — decide whether to merge or clearly
  differentiate (no duplication).
- **Attachments:** unusable (can't edit text/images). Restructure: most
  important attachments on top, rest sorted by type. Position attachments as a
  "catch-all / last" module.
- **Notes:** can't delete individual entries.
- **Q&A (Fragen):** can't delete individual entries.
- **Poll (Umfrage):** can't be configured.
- **Crew:** can't be configured.
- **Work packages (Aufgaben):** can't be configured.
- **Appointment (Termin):** center the content.
- **Range (Von-Bis):** hide for now (remove from picker + classifier).
- **Phases:** make bigger + vertical; show all phases.
- **Table:** "+ col" button does nothing when there's only one column (A).

### Q4 — visible quick-wins — ✅ done (commits `11bbc37`, `f1b185b`)
Dashboard rows fully clickable; WidgetCard clips bare media (border-radius);
Table "+ col" works on empty/one-column tables; Range hidden from the picker;
Appointment centered; Style popover closes on outside-click/Escape; masonry
vertical spacing made constant. The element-level Q3 reste (Moodboard
captions, Shotlist add, Images large-set, Selection↔Moodboard decision) are
now done too — see Q3/Q5 above. **Still open (bigger, separate):** the
creation-centric redesign + Fast-Prompts; "Brief schärfen" AI; the studio
stub pages (Team/Settings/Profile).

### Q4 — Studio / creation UX (original notes)
- Dashboard: open a project by clicking anywhere on its row (not only the
  name). (Done? see card-actions; make the whole card the open target.)
- New-project UX: presets closer to / inside the prompt field (like the
  homepage demo); below, suggest clickable **fast-prompt snippets** (general,
  or preset-specific if a preset is picked) so the user thinks less
  (e.g. "Deliverables für Social Media werden benötigt"). Architecturally: a
  dedicated **Fast Prompts** section (editable; AI can seed some from the
  onboarding answers).
- **Creation-centric redesign:** tighter UI/UX, guide the user more, make the
  prompt field the architectural center. (Design task.)
- Colour/font popover doesn't close on outside click (it should).
- Inconsistent spacing between elements (see Bild-1) — normalise the grid gap.

### Q5 — cross-cutting — ✅ done (commit pending)
Empty-states + add-field hints were a grab-bag of cryptic glyphs ("…", "?",
"○", "..."). Replaced with consistent, helpful German microcopy across the
collaborative collection widgets: Images, Moodboard, Notes, Q&A, Audio,
LocationSuggestions, Sketch (empty hints) and Checklist, Deliverables, Tags,
Discussion, Appointments (add-field placeholders). Visual style was already
uniform (`mono text-[11px] opacity-50 var(--v-muted)`); this was a copy pass.

## Element-Iteration 2 — 2026-06-19 (Leon, Moodboard/Shotlist/Images) — ✅ done (commit `e23100e`)

- **Shared:** `FullscreenOverlay` (portal + scroll-lock + Escape, like Sketch);
  `UploadZone` now does a **client-side per-file size check** (default 4.5 MB =
  platform body ceiling) with a concrete reason — the old ">5 MB" failures were
  rejected by the platform before the 50 MB API check, so the toast had no
  reason. Added a `compact` upload pill.
- **Moodboard:** guiding placeholders (label = lighting example, note = "URL
  oder Notiz") instead of literal "…"; per-image caption capped at 280 chars
  and wrapping (auto-grow textarea); **fullscreen mode** showing images in true
  aspect ratio + full captions/directions; removed the oversized drop field;
  fixed text/control overlaps (top padding clears the hover toolbar, rows get
  right padding, directions wrap).
- **Shotlist:** all fields are auto-growing textareas (wrap + grow) so long
  entries stay readable; German placeholders + small field labels (Zweck /
  Setup·Licht / Ort); right padding so content clears the × control.
- **Images:** removable (hover ×); click → true-format lightbox; compact upload
  pill; figure border + overflow clip so edges align with the frame.

**Still open (next):** the creation-centric redesign + Fast-Prompts; "Brief
schärfen" AI; studio stub pages.

## Product direction — 2026-06-19 (Leon, elements review round 3)

Decisions taken from a live review:
- **Image pipeline** ✅ (commit `991b0de`): client-side compression via
  `browser-image-compression` (downscale 2560px / ~1.6 MB, Web-Worker) in
  `lib/client/imageCompress.ts`, wired into `UploadZone`. Upload route rate
  limit changed from one-per-2s to a **token bucket** (burst 12, refill 1/1.5s)
  so multi-image uploads no longer hit "rate limited". HEIC still falls back to
  original (Chrome can't canvas-decode it) — **follow-up: HEIC→JPEG** (heic2any)
  if iPhone-native files become common.
- **Selection / proofing widget retired** ✅ (`991b0de`): out of the picker and
  the production-stage auto-seed. Per Leon's market read, **no further work on
  image selection / result galleries** — focus is collaborative exploration +
  structuring. Renderer/types kept for back-compat only.
- **Crew → Team header** ✅ (`0b7ef9e`): crew pulled out of the grid into the
  header under the participant dots; removed from the picker. Tighter single
  "Team" panel (roles + un-roled contributors in one component) is a possible
  refinement.
- **Discussion → Ask-MAGYC chat** — PLANNED, not started. Turn the bottom-right
  dock into a persistent collaborative chat (realtime, persisted) → phase 1;
  then `@magyc` for AI advice → phase 2; then agentic actions (configure an
  element, owner-gated) → phase 3. Discussion widget retires from the grid.
- **Look & feel polish pass** over the remaining elements (Notes, Shotlist, Q&A,
  Poll, Tasks …) — still open.
- Static objects on the project page are acceptable (Leon).

## Backend + MVP build — 2026-06-19/20 (Leon)

✅ Done:
- **Studio backend pages** to life in a compact, standardized language: Profil
  (name/headline/specialties/bio, autosave), Einstellungen (working-style rules
  + Fast-Prompts + default language + "shared by default" toggle, autosave),
  Nutzer (structured Team & Kunden), compact dashboard pipeline strip. Backed by
  migration 014 (profiles: headline/bio/specialties/settings) + `/api/studio/profile`.
  Settings rules + default-shared are wired into `/api/projects` creation.
- **Fast-Prompts** (commit `275b781`): account-configured click-to-insert
  snippets below the prompt on `/studio/new`; managed in Einstellungen.
- **Prompt field unified** (commit `45452dd`): shared `PromptComposer` on the
  marketing homepage + `/studio/new`.
- **Sidebar** tightened (commit `e4aa397`) — backend UI/UX direction sample, OK'd.
- **HEIC→JPEG** (commit `4a833b0`): iPhone photos convert via heic2any before
  compression so they upload + display everywhere.

Still open (mostly need Leon's keys / decisions, or a fresh design pass):
- **UI/UX**: Leon not yet happy with the overall look — needs a detailed pass
  when he has energy (he flagged it's "too bulky" in places). Header + Presets
  page still to align to the new language.
- **Stripe + plans** (needs keys + plan decisions), **MCP connect**, **Mail-
  forward** (needs an external mail service), **Media library** (per-user,
  guests blocked) — the big workstreams, each its own session.
- **"Brief schärfen"** AI (the studio clarify step) — still open.

## P1 — correctness

### 3. Lost-update races on module config — ✅ done 2026-06-24
Migration 018 adds `spaces.modules_rev`. Widget add/save/reorder/delete and
@magyc structural tools now send/use the revision they read; updates increment
with `.eq("modules_rev", seen)` and return `modules_conflict` (409) on stale
writes. Client error copy maps the conflict to a reload hint instead of a raw
API code.

### 4. Claim race (slot double-booking) — ✅ done 2026-06-24
Migration 018 dedupes existing active claims, then creates a partial unique
index on `(space_id, module_index, data->>'slotLabel')` for active claim rows.
`state/route.ts` now treats Postgres `23505` conflicts as `slot_taken` (409).

---

## P2 — product levers

### 5. Studio settings: profile and contacts
Presets now have their own `/studio/presets` surface, are backed by the
`studio_presets` table/API, and `/studio/new` loads the same account presets
with local fallback. Remaining Studio settings should also be dedicated flows
rather than dashboard clutter: public profile settings
(`profilname.magyc.site` later), focus tags (Mode, Produktfotografie, …),
profile description, and a lightweight directory for team members and clients
(user accounts). Product decision made: visible project stages are **Planung /
Auswahl / Abgeschlossen** while the current DB enum remains `brief /
production / handoff` until a deliberate migration is worth it.

### 6. Error UX architecture
First consolidation shipped: Sonner is the global action-feedback layer,
direct `toast.*` calls now go through `lib/client/feedback`, and risky module
render surfaces use `react-error-boundary` via `RenderBoundary`. Remaining
quality work is mostly breadth: continue replacing ad-hoc inline errors in
new product areas as they become real (profile/users/settings) and add a
small docs note for future agents: inline = fixable input, toast = async
action feedback, dialog alert = blocking modal failure, boundary = render
fallback.

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

### 9. Realtime sync for project changes — ✅ secure invalidation shipped 2026-06-27
Config and state writes broadcast data-free invalidations; other tabs refetch
through the authorized snapshot API. A per-tab sender id also fixes same-account
multi-tab synchronization. Direct `postgres_changes` project-row subscriptions
were removed; migration 025 removes the obsolete publication entry.

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

### 13. `module_state` unbounded growth — ✅ bounded/compacted 2026-06-27
Migration 024 transactionally compacts repeated item edits. Application limits
cap append-heavy state per module (`voice`, `add`, `upload`, `stroke`), and
upload deletion removes both state and private objects. Historical lazy-loading
is unnecessary at current limits but can be revisited from production metrics.

### 14. Rate limiting on /state — ✅ done 2026-06-24
`/api/spaces/[id]/state` now applies a cheap in-memory per-space/actor bucket
(120 writes/minute). This is not a distributed quota, but it blocks accidental
runaway clients and obvious single-process spam without adding infrastructure.

---

## Code-health review (session 4, 2026-06-13)

Full read-through for leanness / architecture / inconsistencies. #17, #19,
#21 fixed + verified on prod; #18 partially done. Remaining below.

### 18. Inline-edit hook adoption — finish the single-line editors
The `useInlineEdit` hook shipped (`components/widgets/useInlineEdit.ts`) and
Heading / AiSummary / RichText now use it (three `autoResize` copies gone).
**RangeRenderer done (2026-06-22)** — converted behaviour-identically (an
`if (next)` onSave guard preserves its "never save an emptied field" rule;
`focusMode:"all"` + `submitOn:"enter"`).
**Deliberately deferred** (these touch the exempt, well-iterated project-page
widgets and can't be click-tested without a live authed session, so the dedup
benefit isn't worth a blind regression):
- *DateRenderer*, *AppointmentRenderer/AppointmentsRenderer* — native
  `<input type="date"/time>` read the value directly with no draft state; the
  hook makes them controlled + select-on-focus, which can change picker feel.
- *TableRenderer* — a grid of cells with navigation; multi-field, higher risk.
- *TagsRenderer*, *QaRenderer* — these are *add-new-entry* fields with
  normalization/dedup (lowercase+slug for tags), not edit-of-one-value; the
  hook's `value↔onSave` model doesn't fit without forcing it.
Revisit when a prod click-test is available.

### 20. `applyActionLocally` mirrors server state semantics — ✅ done (2026-06-22)
The vote/check/claim dedup keys + retraction rule now live in
`lib/stateDedup.ts` (`SINGLE_ACTIVE_RULES`). `applyActionLocally` (lib/state.ts)
consumes the spec; `state/route.ts` references the same scope-field constants in
its `.filter()` calls. Behaviour unchanged; the two can no longer drift.

### 22. `app/page.tsx` (whole clarify flow inline) — ◑ partly done (2026-06-22)
Conservative extraction shipped: `BuildingScreen` →
`components/home/BuildingScreen.tsx`, and `apiError`/`fetchJsonWithTimeout`/
`formatFlowError` → `lib/home/flow.ts` (975→841 lines, no behaviour change).
**Still open (optional):** lifting the clarify state machine itself into a
`ClarifyFlow` component — deferred because it's the core create path and not
locally click-testable; only worth it with a live session.

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

- 2026-06-22 · **Account-area rebuild + phase flow + mobile/chat polish**
  (4 commits). **Phasen-Flow:** moving a project to Absegnung now (a) asks a
  confirmation dialog (`StudioProjectBar`), (b) locks the project page —
  `/s/[id]` is read-only in production/handoff (`act` no-op + toast, owner
  chrome/GridZone editing hidden; bulky "bereit zur Absegnung" banner replaced
  by a slim locked status line). **Contract release gate:** owner prepares the
  draft, can re-edit it, then manually "Zur Unterschrift freigeben"
  (status `released`, new route `POST /api/projects/[id]/contract/release`);
  signing is server-gated to released contracts. Client sees "Vertrag wird
  vorbereitet" until released, then signs, then "Dein Projekt ist in Arbeit"
  with a link to the plan. **Account pages** rebuilt in the new look via a
  shared `components/studio/formKit.tsx`: Profil, Einstellungen, Vertragsinhalte
  (full conditions/business editor), Nutzer (Team + clients derived from
  contract parties). Data/API unchanged. **Mobile:** `StudioProjectBar` stage
  stepper becomes a compact dropdown <sm (fixes top-bar collision with the
  right-side owner controls). **@magyc chat:** `AssistantDock` redesigned in the
  dark design-system look (German, gradient send, Enter-to-send, auto-scroll,
  greeting bubble). Agent remains stateless (greeting is presentational, not
  history). Open follow-ups: multi-seat team invites (Nutzer page notes it);
  contract chat persistence if @magyc should post into a saved thread.

- 2026-06-18 · **Auswahl-Phase: `selection` widget (proofing-lite)**: new
  `selection` widget (contract 1.4.0→1.5.0) — owner uploads a photo set
  (`upload`), share-link collaborators select/favourite (`check`, itemKey =
  photo id) and comment (`voice`, parentId = photo id). Reuses /upload + /state,
  no DB migration. Registered like `moodboard` (types/contract/modules/
  dispatcher/picker/PresetBuilder). Auto-seeded when a project enters the
  `production` ("Auswahl") stage (PATCH /api/projects/[id]); also in the widget
  picker. Upload owner-only (UI). NOT in the classifier (post-shoot tool).
  Open: hard server-side owner-only-upload per widget; selected photos feeding
  the Abschluss/story page (later phase).

- 2026-06-18 · **Architecture audit cleanup**:
  reconciled the docs/contract with the current photographer-first Studio
  direction. `README.md` and `AGENTS.md` no longer describe MAGYC as only a
  generic 29-widget idea space; they now state the Studio/preset/project
  lifecycle model and the 33-module registry. Bumped the data contract to
  1.4.0 and documented the additive Studio project fields (`stage`, `segment`,
  `shared`, `archivedAt`, `deletedAt`). Fixed a semantic API bug where shared
  owner-auth failures returned 403 with `{error:"unauthorized"}` instead of
  `{error:"forbidden"}`. Replaced the Studio project delete
  `window.confirm()` with the app dialog layer. Added missing `.select("id")`
  guards to project/claim/publish/resolve/version updates so Supabase zero-row
  updates cannot look successful. Preset live previews now translate core
  renderer state actions back into module config for Moodboard, Shotlist,
  Checkliste, Deliverables and Freigaben; root cause was that the preview used
  the real renderers but only persisted `saveModule`, so `ctx.act()`-driven
  edits were visual-only except for Checkliste.
- 2026-06-18 · **Preset reliability and project retention**:
  stabilized the Preset sync loop so missing/unapplied backend migrations no
  longer trigger repeated "Presets nicht gespeichert" toasts; presets keep a
  local fallback and stop remote retries until the API is writable again.
  Preset modules can now be temporarily empty while editing, but saving still
  requires at least one module. The preset element row now behaves like
  removable tags with one active module preview at a time, and unsupported
  preset modules (`ai_summary`, `notes`, `sketch`, plus hidden wiki/gif/icon)
  are excluded. Checklist additions in the preset preview update the module
  config directly instead of failing with invalid input. Project creation now
  honors the preset "Kontext-Elemente erlauben" toggle: off means only header
  modules plus preset modules are stored; on lets MAGYC add extra contextual
  modules. Added soft-delete and archive columns/routes/UI: dashboard active
  projects exclude archived/deleted rows, archived projects live in Ablage,
  deleted projects stay restorable for 30 days. Production requires running
  migrations `012_studio_presets.sql` and `013_project_retention_and_preset_options.sql`.
- 2026-06-18 · **Account preset persistence**:
  added `studio_presets` migration and `/api/studio/presets` so workflow
  presets are stored per Clerk user instead of only in browser localStorage.
  `PresetBuilder` now loads account presets, writes local cache for
  resilience, debounces saves back to the API, and shows sync status plus
  shared Sonner feedback on failures. `/studio/new` now loads the same
  account presets before project creation, with local/default fallback if
  the API is unavailable. Note: production requires running migration
  `012_studio_presets.sql` before account sync is active.
- 2026-06-18 · **Consolidated error UX system**:
  finished the first complete pass on feedback architecture. Added
  `lib/client/feedback` as the single client-side wrapper around Sonner and
  API error mapping; direct `toast.*` calls now live only in that helper.
  Connected Studio project creation, claim/publish, widget add/remove/reorder,
  widget save, prompt-regeneration, style saving, sharing, phase changes,
  project duplicate/delete, uploads and assistant failures to the shared
  feedback path while keeping inline errors where users can fix local input.
  Added `react-error-boundary` and `RenderBoundary` fallbacks around project
  header widgets, grid widgets and preset preview widgets, so one broken
  renderer no longer breaks the whole workspace. Also replaced duplicate API
  raw DB errors with stable client-facing codes where found.
- 2026-06-18 · **Guest draft claim and feedback pass**:
  tightened the anonymous draft → sign in → Studio save flow. Sign-in now
  returns with an explicit `claim=1` intent in addition to the existing
  session flag, so the app can resume the save action after Clerk completes.
  Claim API no longer requires the browser owner token when the space is
  already owned by the signed-in user, making legitimate retries safe.
  Claimed private Studio projects no longer expose the publish/save control
  from `SpaceView`, avoiding the confusing "only publish remains" state.
  Publish/claim actions now show Sonner loading, success and error feedback,
  and blocking dialog errors render as visible alert blocks instead of tiny
  inline text. Publish API now returns stable `publish_failed` errors instead
  of raw database messages.
- 2026-06-18 · **Studio motion language**:
  added shared Motion variants for Studio pages, staggered operational
  surfaces, rows, overlays, panels and popovers in `lib/anim`. The Studio
  dashboard now lands with a calm page reveal, phase cards and project rows
  stagger into view, the sidebar has a moving active marker, project action
  menus animate as popovers, `/studio/new` animates preset selection and
  optional project details, and the preset editor / element picker now open
  with the same intent-driven panel language. Product rule for future work:
  motion should clarify state, focus and flow; it should not be decorative
  noise.
- 2026-06-18 · **Preset-driven project start**:
  connected Studio presets to actual project creation. Preset definitions
  now live in a shared `lib/studioPresets` registry used by both
  `/studio/presets` and `/studio/new`, and empty draft presets survive
  local storage instead of being silently dropped. `/studio/new` now lets
  photographers start in **Planung** with or without a preset, previews the
  prepared elements, and sends selected preset modules plus prompt rules
  to `/api/projects`. The project API sanitizes preset modules, passes them
  into the classifier as preconfigured body modules, and records preset
  metadata in AI events. Also replaced raw create/claim/update/delete
  errors with stable error codes plus friendlier client messages, and
  removed remaining "Briefing" wording from the Studio phase cards.
- 2026-06-18 · **Preset draft and picker logic**:
  changed presets from forced Moodboard defaults to true drafts: new and
  edited presets may temporarily have zero elements, but closing/saving
  the editor requires at least one selected element. All presets can now
  be deleted, including the last one. Removed AI summary, notes and sketch
  from the preset element pool, and reused the project-page
  `WidgetPickerContent` for preset element selection with a preset-specific
  allowed-type filter instead of the old inline list.
- 2026-06-18 · **Preset project-preview parity**:
  changed the preset element preview from a custom scrollable settings
  frame into a miniature project-grid surface using the same terminal
  vibe, dot field, radius, border and two-column cell sizing rules as
  project pages. The selected module now renders in a real grid cell
  without an extra overflow cage, so map widgets and address suggestion
  overlays can display like they do on the actual project page.
- 2026-06-18 · **Studio intent UI pass**:
  reframed Studio UI as product logic rather than decoration. The Studio
  sidebar now explains each area through concise purpose hints without a
  hard white active state, the Studio shell has a clearer work-surface
  transition, and preset editing no longer opens as a blunt inline block
  below the table. Create/edit intent opens a focused right-side workflow
  panel with its own scroll region and footer actions, keeping the preset
  table as an overview surface. Preset module previews now sit inside a
  controlled project-preview frame so project renderers do not collide
  visually with the settings chrome.
- 2026-06-17 · **Preset module renderer alignment**:
  corrected the preset architecture so preset elements store real `Module`
  configs and render through the same `WidgetDispatcher` / `WidgetContext`
  path used by project pages. The preset editor now opens only after explicit
  create/edit intent; active element previews use the actual project renderer,
  so map/location presets show the real map element instead of a fake form.
  `components/WidgetPicker.defaultWidget` is now exported as the shared
  default module factory to avoid a second element truth.
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
