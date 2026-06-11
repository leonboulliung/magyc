# MAGYC — AI-Powered Spaces

Transform text into structured, collaborative workspaces. Drop an idea, get a plan.

**MAGYC** breaks down your input into organized **Spaces** with 29 widget types:
maps, timelines, checklists, sketches, galleries, discussions, crew rosters,
work packages, and more. Edit collaboratively in real-time with teammates.

## Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. On first load the storage schema migration wipes
any prior state to guarantee a clean slate.

## What's in the box

- **`/`** — email gate → live feed, with a `FEED / MAP` toggle in the header
- **`/post/[id]`** — card detail: join / request / edit / delete / share
- **`/carnet`** — your personal archive (list · map · export PNG + PDF)
- **Floating + button** — post your one thing of the week
- **Live Paris clock** + scrolling ticker in the header
- **Leaflet + CartoDB Positron** (no labels, B&W) map · bounded to Paris + 1st ring
- **Procedural vibe gradients** instead of image uploads
  (`title × time-of-day × location` → sky + sun + accent + optional stars)
- **Canvas share-as-image** (1080×1350 PNG) on every card and every Carnet row
- **Cross-tab realtime** via `storage` event + in-window pub/sub
- **Versioned storage** — bump `STORAGE_VERSION` in `lib/storage.ts` to wipe

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Leaflet ·
Inter + JetBrains Mono.

## Files

```
app/
  layout.tsx        global shell + fonts
  page.tsx          email gate → feed/map
  post/[id]/page.tsx
  carnet/page.tsx
  globals.css       Tailwind + leaflet css + procedural noise/stars
components/
  Header.tsx        clock + ticker + FEED/MAP + avatar
  Ticker.tsx
  EmailGate.tsx     email → avatar two-step
  Feed.tsx          list/map switch
  CardItem.tsx
  CardCreate.tsx    title/when/spots/permission + map-pin / autocomplete
  ParisMap.tsx      Leaflet with custom pins + 10s fresh pulse
  VibeBackground.tsx
lib/
  storage.ts        versioned localStorage + pub/sub + cross-tab
  types.ts
  vibe.ts           activity × time × location → CSS gradient
  quartiers.ts      ~90 Paris neighborhoods + landmarks with lat/lng
  share.ts          Canvas → PNG + navigator.share + Carnet poster + PDF
  time.ts           Paris clock + time-ago
```

## Reset

Bump `STORAGE_VERSION` in `lib/storage.ts` and reload — every `cp:*` key is
wiped on next page load.

## Notes / philosophy

This isn't a tool, a feed, or a SaaS. It's a pulse — a way for the people who
shape Paris's culture to make their week visible to the people who'd want in.
Curation and taste are first-class contributions, equal to "doing". Every
archived card is a piece of someone's cultural footprint in this city.
