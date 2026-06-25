# MAGYC — Agent Briefing

**This file is the single source of truth for any AI agent (Claude, Codex, …)
working on this repo.** Read it fully before touching code. Keep it accurate:
if you change architecture, workflows, or conventions, update this file in the
same commit.

- Product: **MAGYC** — a photographer-first project workspace. A prompt or
  reusable Studio preset becomes a structured Space for planning, selection,
  client collaboration, delivery, and references. The underlying AI composer
  still supports broader creative spaces through 33 module types.
- Prod: **https://magyc.site** · Repo: github.com/leonboulliung/magyc (`main`)
- Owner: Leon Boulliung (leon.boulliung@grabitautomaten.de)

---

## 1. Golden rules (non-negotiable)

1. **No localhost.** All testing happens against the Vercel deployment
   (magyc.site). Don't start dev servers to "verify" — deploy and check prod.
2. **Commit and push after every change**, without asking. Never leave work
   uncommitted at the end of a session.
3. **Push = deploy.** GitHub→Vercel auto-deploy works (re-linked via
   `vercel git connect`, 13 Jun 2026): every push to `main` builds and
   promotes to production (~1 min). Full loop:
   ```bash
   npx tsc --noEmit                 # must be clean
   git add -A && git commit -m "…" && git push
   # wait ~1 min, verify on https://www.magyc.site
   ```
   Fallback if the webhook breaks again: `vercel --prod --yes` deploys the
   local working tree directly.
4. **AI must not invent facts** (Leon's product rule). The AI layer may
   abstract and structure the user's own input — never add specifics the user
   didn't say (no fake dates, places, numbers).
5. **The data contract is frozen.** `docs/DATA_CONTRACT.md` +
   `lib/contract.ts` define Space/Module/state shapes. Presentation may change
   freely; data shapes change only deliberately, with a `CONTRACT_VERSION`
   bump and a doc update.
6. **End-of-session protocol:** update `docs/BACKLOG.md` (mark done, add new
   findings with root-cause notes), update this file if conventions changed,
   commit + push. The next agent has no memory of your session — the repo is
   the only handover.

---

## 2. Stack & access

| Layer | What | Access / notes |
|---|---|---|
| Framework | Next.js 14 App Router, React 18, TS, Tailwind | |
| Hosting | Vercel, region `fra1` (vercel.json), domain magyc.site | `vercel` CLI is logged in locally |
| DB + Realtime + Storage | Supabase Postgres/Realtime/Storage, project ref `zpkgofpkksetnbuizvhi` (eu-central-1) | client: anon key; API routes: `supabaseAdmin()` (service_role, bypasses RLS); media uses signed direct uploads + signed reads |
| Auth | Clerk (`@clerk/nextjs`), email OTP | publish binds a draft to a Clerk account |
| AI | OpenAI `gpt-4o-mini` (classify, clarify, regenerate) | |
| Maps | Leaflet + CARTO tiles; geocoding via Komoot Photon (free, no key) | |
| Anim | motion/react · dnd-kit (grid reorder) · Radix (popover/dialog) | |

Env vars live in `.env.local` (local) and the Vercel dashboard (prod). Treat
the Vercel dashboard as canonical; local `.env.local` may be stale and should
be checked before local verification. Names: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`OPENAI_API_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
(+ Clerk URL vars). Never print or commit values.

DB schema: `supabase/migrations/` (current), `supabase/migrations-archive/`
(predecessor app, historical only). Schema changes are applied manually in the
Supabase SQL editor — there is no migration runner wired up.

---

## 3. How the product works (mental model)

1. **Home (`app/page.tsx`)**: user types an idea in the shared German
   `PromptStart` composer (same presets + Schnellbausteine as Studio) →
   `/api/spaces/clarify` returns typed clarify steps (choice / text / module
   editors) → `/api/spaces` runs the classifier and creates the space →
   redirect to `/s/[id]`.
2. **Studio (`app/studio/(shell)/`)**: signed-in photographers manage projects,
   reusable presets, users/permissions, profile, and settings. New projects use
   the same prompt → clarify → build flow as Home, then `/api/projects` binds
   `owner_id` immediately, applies Studio presets/settings, and moves through
   Planung / Auswahl / Abgeschlossen. Presets must stay close to the real
   project architecture: their per-element preview/configuration renders the
   actual widget renderer through `WidgetDispatcher`, not a parallel form.
3. **Classifier (`lib/server/classify.ts`)**: two-stage. Stage A scores all
   30 body module types 0–10 against the input (gpt-4o-mini); the **server**
   deterministically selects (threshold + redundancy caps: max one date
   widget, max one place widget). Stage B authors content for the chosen
   types in the detected language, plus title, labels, style (font + 3
   colors). Map widgets are geocoded server-side; unresolvable ones dropped.
4. **Space page (`app/s/[id]/`)**: SSR-seeded (`page.tsx` fetches, hands
   `initialSpace` to the client `SpaceView`). Three zones: header
   (heading + rich_text + tags), **GridZone** (body widgets, masonry,
   drag-reorder), participants bar.
5. **Ownership**: a draft space belongs to whoever holds its
   `anonOwnerToken` (localStorage, `magyc.space_owner.<id>`). Publishing
   requires Clerk sign-in and binds `owner_id`. Published spaces: structural
   edits are owner-only; collaborative interaction is open to everyone.

### The two state planes — never mix them

| | Module **config** | Module **state** |
|---|---|---|
| What | The widget's own definition (poll question, heading text, map pins) | Collaborative actions (votes, checks, claims, messages, strokes, uploads) |
| Table | `spaces.modules` (JSONB array) | `module_state` (one row per action) |
| Who | Owner only | Every visitor (anon token or Clerk) |
| API | `PUT/POST/PATCH/DELETE /api/spaces/[id]/widgets…` | `POST /api/spaces/[id]/state` |
| Client write path | `ctx.saveModule(index, module, opts)` — optimistic patch, rollback on failure, "saved" toast with undo | `ctx.act(index, kind, data)` — optimistic apply via `applyActionLocally`, realtime echo reconciles |
| Realtime | none yet (BACKLOG P2) | Supabase channel on `module_state` INSERT/DELETE |

`WidgetContext` (lib/widgetContext.ts) carries `spaceId, isOwner, ownerToken,
refresh, patchModule, saveModule, act` into every renderer. **Renderers must
not hand-roll fetch calls to the widgets API — always `ctx.saveModule`.**

### State kinds (server semantics in `app/api/spaces/[id]/state/route.ts`)

`vote` (one per actor/module, empty = remove) · `check` (toggle per
actor+itemKey) · `claim` (one actor per slot, 409 if taken) · `voice`
(append message) · `edit` (last-write-wins) · `add` (append item) ·
`upload` (Storage URL) · `stroke` (sketch path).
Client-side mirror semantics live in `lib/state.ts` (`applyActionLocally`).
If you change one side, change the other.

---

## 4. Code map

```
app/
  page.tsx                  Home: input → clarify → build (timeouts, friendly errors)
  s/[id]/page.tsx           SSR fetch + metadata (React cache())
  s/[id]/SpaceView.tsx      THE hub: live state, realtime, saveModule, act, notices
  api/spaces/route.ts       POST create (classify)
  api/spaces/clarify/…      clarify steps
  api/spaces/[id]/widgets…  config CRUD + regenerate (AI alternatives)
  api/spaces/[id]/state/…   collaborative actions
  api/spaces/[id]/{claim,publish,style,upload,assets/sign,resolve}/…
  api/projects/…            account-first Studio project CRUD
  api/studio/presets/…      per-user workflow preset persistence
  api/{geocode,gif}/…       proxies (Photon, GIF search)
  dev/page.tsx              widget showroom (all 33 widgets w/ fixtures)
  studio/(shell)/…          Studio dashboard, project builder, presets, settings
components/
  create/PromptStart.tsx    single source of truth for Home + Studio prompt composer
  GridZone.tsx              body grid: dnd-kit reorder, add/remove, full/half width
  widgets/WidgetDispatcher  type → renderer map (heavy ones via next/dynamic)
  widgets/WidgetShell.tsx   owner chrome: ⇆ alternatives + AI prompt-edit bubble
  widgets/*Renderer.tsx     one per widget type
  clarify/…                 typed clarify-step editors (location, phases, date…)
  StyleEditor / PublishButton / SpacePrivacy / ParticipantsBar
lib/
  types.ts                  Module union (33 types), Space, state kinds — START HERE
  modules.ts                sanitizers + MODULE_META (relevantWhen, labels, icons)
  contract.ts               compile-time guards binding types ↔ DATA_CONTRACT.md
  state.ts                  optimistic state engine (client mirror of server semantics)
  db.ts                     row mapping + queries (client reads, anon key)
  server/                   classify, clarify, regenerate, geocode, wikipedia
  labels.ts                 AI-generated UI strings (per-space language)
  style.ts / fonts.ts       space style sanitizing + font catalog
  anonId.ts                 anon identity + per-space owner tokens (localStorage)
```

### Adding a widget type (the full checklist)

1. `lib/types.ts` — add to the `Module` union + `ModuleType`.
2. `lib/modules.ts` — sanitizer + `MODULE_META` entry (`relevantWhen` drives
   AI scoring; label/icon drive the picker).
3. `components/widgets/<X>Renderer.tsx` + register in `WidgetDispatcher`
   (use `next/dynamic` if it pulls heavy deps like Leaflet).
4. If AI-authorable: add to `SCORING_GROUPS` + `SHAPE` in
   `lib/server/classify.ts`.
5. `lib/contract.ts` will **fail the build** until you record it in
   `docs/DATA_CONTRACT.md` and bump `CONTRACT_VERSION`.
6. Add a fixture to `app/dev/page.tsx` (showroom).

---

## 5. Conventions

- **Optimistic-first**: every interaction updates the UI instantly; the
  server write follows; rollback on failure. No spinners for actions.
- **Visual system**: spaces are themed via CSS vars (`--v-bg, --v-fg,
  --v-muted, --v-rule, --v-accent, --v-radius, --v-font`). Use the vars,
  never hardcoded colors/radii in renderers. Motion language:
  `docs/MOTION.md`.
- **Validation**: every API route parses its body with zod via
  `parseBody` (lib/api/validate.ts). Auth checks: draft = anon token match,
  published = Clerk owner.
- **Language**: each space has ONE language (detected from input); all
  AI-authored strings + UI labels are in it. Code/comments in English.
- **Studio wording**: user-facing Studio labels are German for the German
  launch market. The prompt entry headline is "Plane deinen nächsten
  Fotografie-Auftrag"; "Fast-Prompts" are called "Schnellbausteine".
- **Element UX rules**: no grid-level two-width/full-width toggle. If an
  element needs a larger temporary view, the renderer owns that affordance
  (Moodboard fullscreen is the model). Empty configurable widgets should start
  empty when useful, but render clear German empty states and explicit actions
  (`+ Eintrag hinzufügen`, `+ Frage hinzufügen`, etc.) instead of raw `…` or a
  bare `+`. Long user text must wrap inside the card (`break-words` /
  `overflow-wrap:anywhere`). Productive renderers should use the real widget
  UI in Preset previews through `WidgetDispatcher`; don't create parallel
  preset forms unless the data contract requires a separate abstraction.
- **Supabase gotcha**: `.update()` without `.select()` reports success even
  when 0 rows matched. Always chain `.select("id")` and treat an empty
  result as an error.
- **Next 14 gotcha**: server-side `fetch` (incl. supabase-js) is cached by
  default. Pages that read mutable data must export
  `const dynamic = "force-dynamic"`.
- **Error-UX layers** (pick by failure kind): _inline_ = a fixable input
  problem, shown next to the field; _toast_ = async action feedback, always via
  `lib/client/feedback` (`showApiError`/`showActionError`/`showActionSuccess`),
  never raw `toast.*`; _dialog_ = a blocking modal failure that needs a choice;
  _boundary_ = a render crash, caught by `RenderBoundary`. Map server error
  codes to German once, centrally, in `lib/client/errors.ts` (`apiErrorMessage`)
  so every caller is consistent — don't special-case messages per call site.
- **Media infrastructure**: browser file blobs must not be proxied through
  Vercel functions. `UploadZone` asks `/api/spaces/[id]/upload` for a signed
  Supabase Storage upload token, uploads directly with `uploadToSignedUrl`,
  then commits the `module_state` row. Renderers resolve private object paths
  through `/api/spaces/[id]/assets/sign` and must keep supporting legacy
  public `url` rows as fallback. Every upload renderer must show accepted file
  types + max size through the shared `UploadZone` helpers; keep the client
  accept list and `lib/server/uploadSecurity.ts` allowlist in sync. The
  `space_assets` bucket is intended to be private after migration 019.
- **Persistent limits**: cost/security limits must be durable across Vercel
  instances. Use the Supabase `take_rate_limit` RPC from migration 019 for
  AI, uploads, asset signing, and high-volume state writes; in-memory guards
  are only a fast local debounce.

---

## 6. Where everything else lives

| Doc | Purpose |
|---|---|
| `docs/BACKLOG.md` | **Prioritized known issues + improvement queue, with root-cause notes.** Check before starting work; update before ending. |
| `docs/DATA_CONTRACT.md` | Frozen data shapes (binding) |
| `docs/MOTION.md` | Motion/aliveness design language |
| `TODO-LAUNCH.md` | Launch-gated items needing Leon's decision (email digest, trust & safety, emergent-functions idea) |
| `docs/archive/` | Predecessor app ("one card per week" Paris feed). Historical only — **do not** follow anything in there. |
