# Open Feedback — Iteration Backlog

Captured from agent AI usability run, 28 May 2026.

**Iteration 1 done (28 May 2026):** #1, #2, #3, #5 ✅ — see status tags below.
**Still open:** #4 (light version shipped, full jump-to-map not built), #6, #7 (design conversations).

---

## Bugs (concrete, reproducible)

### 1. "TOMORROW 00:00" wrong time label  ✅ FIXED
Root cause was timezone drift: composer computed times in client-local, display
mixed Paris-TZ (startsLabel) with client-local (toLocaleString). Fix: all event
times now anchored to Paris wall-clock via `parisWallTimeToMs` / `wallClockToParisMs`
in lib/time.ts; the composer picker, AI hydration, and all display surfaces read
Paris time. Detail page STARTS now uses `fullStartLabel` (Paris) + a "· PARIS" tag.

<details><summary>Original report</summary>
- Severity: medium
- Surfaces: feed list (`CardItem`) + profile track record (`carnet/page.tsx > TrackRow`)
- Detail surface (`/post/[id]`) shows the time correctly as `Thu 28 May, 15:00`.
- The summarized label ("TOMORROW · 15:00") loses the time and reads `TOMORROW · 00:00` instead.
- Likely upstream: AI-drafted `startsAtIso` arrives as date-only or midnight-UTC, and somewhere in the When-picker hydration the user's chosen time isn't reaching `expires_at`. Worth checking:
  - `app/api/cards/draft/route.ts` → `isoOrNull` — date-only strings get parsed to UTC midnight
  - `components/CardCreate.tsx` → `useEffect` that hydrates dayMode/hour/customHM from `initialDraft.startsAtIso`
  - Whether the user kept the AI's time or the picker re-overwrote it
- Verify with both AI flow ("draft for tomorrow at 15h") and manual flow (pick TOMORROW + 15H chip).
</details>

### 2. "Public Join" toggle unreliable  ✅ FIXED
Not a click bug — `permission` started `null`, so the user had to actively pick and
the null state looked like "nothing happened". Fix: `permission` now defaults to
`"public"` (AI can override to `"request"`), removed from the required-fields gate.

<details><summary>Original report</summary>
- Severity: medium
- "Lässt sich nur durch wiederholtes Klicken zuverlässig aktivieren."
- Suspicion: the permission button's click handler or the rendering of `active` state has a race. Inspect:
  - `setPermission("public"); confirm("permission");` — both fire same tick, should be fine
  - But the `permission === null` initial state means first click activates, second click… does nothing? Or somehow toggles back?
- Reproduce: open composer, click PUBLIC JOIN once, check if it visibly activates immediately.
</details>

---

## Missing affordances

### 3. No post-creation confirmation  ✅ FIXED
POST now redirects to `/post/[id]?new=1`; the detail page shows a dismissable
"✓ THING POSTED · IT'S LIVE ON THE MAP" banner for 5s, then strips the param.

### 4. After picking location, no shortcut to "jump to the map pin"  ◑ PARTIAL
Desktop already pans the live sidebar map to the picked pin (existing behavior).
Full "jump to my event on the main map after posting" not built — the post-confirm
banner + detail mini-map cover most of the need. Revisit if users still ask.

### 5. Username cooldown indicator visible outside the editor  ✅ FIXED
`/carnet` now shows "↺ USERNAME CHANGEABLE AGAIN · <date>" under the stats line
when inside the 7-day window (mirrors the ProfileEditor rule).

---

## UX direction (no concrete fix, design conversation)

### 6. Two-stage create flow feels unusual for first-time users
- The split "draft from sentence" → "review structured form" is unfamiliar.
- Options to discuss next iteration:
  - Onboarding tooltip on first draft attempt explaining the two stages
  - Make the prompt step optional and not the default (move "fill manually" to equal-weight CTA)
  - Show both states side-by-side on desktop (prompt input always visible, form fills as user types or after submit)

### 7. Navigation discoverability
- "Back to Paris" links hard to find. Large editorial headings + dark backgrounds reduce orientation.
- Agent suggests more classical nav: visible buttons for Karte / Profil / Explore.
- This conflicts with the current editorial direction — discuss intent before pulling.

---

## Quick triage suggestion for next iteration

Order I'd recommend tackling these:

1. **Bug #1** (TOMORROW 00:00) — concrete, breaks trust
2. **Bug #2** (Public Join clicks) — concrete, frustrating
3. **#3** (post-confirmation toast) — cheap, real UX gain
4. **#5** (cooldown surface) — cheap, completes the username feature
5. **#4** (location preview) — bigger lift, worth scoping
6. **#6, #7** — design conversations, not code-yet
