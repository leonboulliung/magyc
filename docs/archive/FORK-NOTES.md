# Fork Notes — `fork/emergent-design`

An exploratory fork of an earlier MAGYC iteration that reshapes the core object model around
the real vision: **collapse the gap between having an idea and it becoming real.**
A thought becomes real by being shared. *Aus Mensch und Idee wird Gemeinschaft
und Sache.*

This is a diff to review, not a merge-ready PR. It typechecks (`npx tsc --noEmit`)
and builds (`npx next build`) clean.

---

## 1. The new model

Two object kinds on the existing `cards` table + one bridge. Stages are
**behavioral, not declared** — the user never picks a "phase".

| | **Idea** (Idee) | **Thing** (Sache) |
|---|---|---|
| What | A thought thrown into the field — "wouldn't it be great if we…" | Concrete, doable, joinable (≈ the old card) |
| Cost | Cheap. Only the text is required. | Needs enough to be joinable: place + start + spots |
| Mechanic | One-tap **resonance Signal** ("I'd want this / I'd help") | **Join** a crew |
| Time/place | Optional (loose location at most) | Required |
| Lifetime | "Open until it happens" (reuses `archived`) | Auto-hides once started or full (unchanged) |

**Transformation (Idea → Thing)** is a deliberate human act, owner-only. The
author adds a place + start + spots; the *same row* flips `kind` in place (so the
`/post/[id]` URL and its OG metadata survive), and **everyone who signalled is
carried over as the warm first crew** — written into `join_requests` so the
author keeps a light accept/decline gate. Resonance becomes reality.

Kept light:
- Posting an idea never funnels you toward a thing — many ideas just float.
- An idea does **not** auto-archive your live thing. The "one live thing per
  person" rule still holds for *things only*; you can hold many floating ideas.
- Two entry points (throw an idea / plan a thing), optional AI bridge.

---

## 2. The core loop (screenshot-free walkthrough)

1. **Throw an idea.** FAB reads `＋ THROW AN IDEA`. The composer leads with the
   fast Idea path: one sentence ("Wouldn't it be great if…"), nothing else
   required. Optionally expand for a note, tags, and a *loose* place. On submit
   you land on `/post/[id]?new=idea` with a "✓ IDEA IN THE FIELD" banner.
2. **It appears in the field.** Home leads with **THE FIELD** (the docked panel,
   now open by default on every viewport). Ideas sit on top (quiet paper, dashed
   left edge, the open-ring "idea mark", a resonance meter), things below (the
   familiar bold color blocks). The map behind is a *lens*: ideas with a loose
   pin show as **hollow** rings, things as **filled** discs.
3. **Another user signals.** On the idea (logged out too — full item is visible),
   a big `SIGNAL · I'D WANT THIS` button. Tapping it logged-out triggers sign-up
   at that exact moment (join = onboarding). Logged-in it's an optimistic
   one-tap toggle; the resonance meter and count update live (Supabase realtime
   now also streams `signals`).
4. **Author transforms it.** On their own idea the owner sees `MAKE IT REAL →`
   (it *breathes* once there's resonance). The transform panel asks only for
   WHERE / WHEN / HOW MANY / permission. On submit, the idea becomes a thing, the
   signalers become invited (pending) crew, and the author lands on
   `/post/[id]?new=thing` ("✓ IT'S REAL NOW").
5. **People join.** The thing now behaves exactly like the original card —
   join / request / crew / roles. The author accepts the carried-over signalers
   from the pending-requests list.

---

## 3. Design moves

Leon's critique: *clean but sterile, too uniform, doesn't signal where to click.*

- **Ideas vs Things look and feel distinct.** Things = solid color blocks (loud,
  concrete). Ideas = paper ground + dashed left edge + open-ring mark + a
  resonance meter (latent, intellectual). This is the single biggest hierarchy
  win — the eye instantly knows what kind of thing it's looking at, and the map
  pins differ too (hollow vs filled).
- **Lead with the field, not the map.** Cold-start principle: an empty map is
  dead at N=0, but ideas are cheap so the field fills with intellectual life
  before there are events. The panel is now "THE FIELD", open by default, ideas
  first. The map is offered as one view among others.
- **Primary actions are obvious and inviting.** The signal button is a large
  outline pill that fills warm (`#c2452f`) on hover/active — resonating feels
  physical. The transform CTA breathes when an idea is ready. Disabled states
  spell out exactly what's still needed.
- **Aliveness via motion + meaning, not chrome.** New keyframes (`signalPop`,
  `breathe`, `rise`) are small and purposeful; reused existing `twinkle`/
  `fadeIn`/`cpPulse`. No new animation dependency — pure CSS/Tailwind.
- **Editorial base preserved.** Inter + JetBrains Mono, B&W ground, real Paris
  time-of-day tints on the map — all untouched.

---

## 4. Data model + the SQL to run

`kind` lives on `cards` (default `'thing'`, so every legacy row keeps its
meaning). Idea-only fields (`location`, `spots`, `permission`, `expires_at`,
`duration_days`) are made nullable. A lightweight `signals` table holds
resonance (lighter than `joiners`: no role, no accept/decline).

**Migration file:** `supabase/migrations/008_ideas_signals.sql` (NOT run — Leon
runs migrations in Supabase). It is idempotent and safe to re-run. Full SQL:

```sql
-- kind discriminator. Default 'thing' so existing cards keep working.
alter table cards add column if not exists kind text not null default 'thing'
  check (kind in ('idea', 'thing'));

-- An idea is cheap: everything except the text is optional.
alter table cards alter column location   drop not null;
alter table cards alter column spots      drop not null;
alter table cards alter column permission drop not null;
alter table cards alter column expires_at drop not null;
alter table cards alter column duration_days drop not null;
alter table cards drop constraint if exists cards_duration_days_check;
alter table cards drop constraint if exists cards_spots_check;
alter table cards add  constraint cards_spots_check
  check (spots is null or (spots >= 1 and spots <= 99));

create index if not exists cards_kind_active_idx
  on cards (kind, archived, created_at desc) where archived = false;

-- Signals — resonance on an idea. One per (card, user).
create table if not exists signals (
  card_id    text not null references cards(id) on delete cascade,
  user_id    text not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);
create index if not exists signals_card_idx on signals(card_id);
create index if not exists signals_user_idx on signals(user_id);

-- RLS — public read, writes only via service_role.
alter table signals enable row level security;
drop policy if exists "signals_select_all" on signals;
create policy "signals_select_all" on signals for select using (true);

-- Realtime — stream signal changes so the field feels alive.
do $$
begin
  alter publication supabase_realtime add table signals;
exception
  when duplicate_object then null;
end $$;
```

---

## 5. Code map of the change

**API (all guarded: Clerk `auth()` + `supabaseAdmin()`):**
- `app/api/cards/route.ts` — POST now branches on `kind`. Ideas insert with
  null time/place/spots; things validate exactly as before.
- `app/api/cards/[id]/signal/route.ts` — **NEW.** POST = signal (idea-only,
  idempotent upsert), DELETE = withdraw.
- `app/api/cards/[id]/transform/route.ts` — **NEW.** Owner-only. Flips
  idea→thing in place, validates the new concrete fields, carries signalers →
  `join_requests`, clears the signals.
- `app/api/cards/[id]/join/route.ts` — rejects joining an idea (`not_a_thing`),
  null-safe on `expires_at`.
- `app/api/cards/draft/route.ts` — AI now also infers `kind`; an idea can be
  drafted with nothing but the text.

**Data layer:**
- `lib/types.ts` — `CardKind`, `Signal`, `card.kind`, nullable thing-fields,
  `card.signals`.
- `lib/db.ts` — `signals` joined into `CARD_SELECT`; `fetchActiveCards()` now
  returns things only; added `fetchActiveIdeas()` (hottest resonance first) and
  `fetchField()`.
- `lib/realtime.ts` — also subscribes to the `signals` table.
- `lib/share.ts` — share/poster paths made idea-aware + null-safe.

**UI:**
- `components/ResonanceMeter.tsx`, `components/SignalButton.tsx`,
  `components/IdeaItem.tsx`, `components/IdeaComposer.tsx`,
  `components/TransformPanel.tsx` — **NEW.**
- `app/page.tsx` — leads with the field (ideas + things), map gets both kinds.
- `components/FeedPanel.tsx` — rewritten into "THE FIELD" (ideas section +
  things section).
- `components/CardComposer.tsx` / `components/PromptStep.tsx` — two entry points
  + AI bridge that routes to the right composer by inferred kind.
- `app/post/[id]/PostDetail.tsx` + `page.tsx` — idea vs thing layouts; idea OG
  copy invites resonance.
- `components/ParisMap.tsx`, `components/CardItem.tsx`, `app/carnet/page.tsx`,
  `app/u/[id]/ProfileView.tsx`, `components/Constellation.tsx`,
  `app/sitemap.ts` — made kind-aware / null-safe.

Preserved untouched: `lib/supabase.ts` safeCreate pattern, `next-env.d.ts`.

---

## 6. How to run

```bash
# from the fork root
npx tsc --noEmit      # clean
npx next build        # clean
npm run dev           # http://localhost:3000
```

`.env.local` is present (Clerk + Supabase + OpenAI). **Before the new model
works against the real DB, run `008_ideas_signals.sql` in Supabase** — until
then, `kind`/`signals` columns don't exist and idea reads/writes will error.

---

## 7. What's stubbed / not verified / deferred

- **Runtime not exercised against live data.** `tsc` + `next build` pass, but I
  could not click through the loop with a real Supabase instance from here
  (the migration must be applied first, and no preview harness was available in
  this session). The end-to-end loop is wired and type-correct; treat the first
  live run as the real smoke test. Most likely first-run snag: forgetting to run
  the migration (the `signals` join in `CARD_SELECT` will 400 until then).
- **Realtime for `signals`** depends on the table being in the
  `supabase_realtime` publication — the migration does that, but the client
  subscription is wrapped in try/catch and degrades gracefully (60s polling
  still refreshes the field).
- **Idea editing** only edits title + description (no tags/location edit UI on
  the detail page yet). The composer covers those at creation.
- **"One live thing per person"** is enforced for things; transform also
  archives any *other* live thing you own. Not heavily exercised for edge cases
  (e.g. transforming while you already have a live thing — it archives the old
  one, which is the intended behavior).
- **No new dependency added.** All animation is CSS/Tailwind (`tailwind.config`
  keyframes `signalPop` / `breathe` / `rise` + existing ones).
- The pre-existing `share.ts` PNG-poster fallback for an idea with no location
  uses the Paris center for the pin — fine, but the poster reads better for
  things. Low priority.

---

## 8. Branch

`fork/emergent-design`. Commits trailered
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
