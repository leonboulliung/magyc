# Quality audit — 2026-07-01 (Opus, stability / scalability / usability / IA)

Scope: an independent maturity audit focused on the information-architecture
pipeline (prompt → project page → contract), the two-plane element system
(config vs. state, project vs. preset window), theming, stability and
usability. Method was static pipeline analysis (no local dev flow); `tsc`,
`npm test` (51 pass) and the production build were the regression gate.

## Verdict

The application is **mature**. The core IA pipeline is sound:
`classifyInput` grounds content (no fabrication), `buildProjectFacts` merges
`modules` + live `module_state` so collaborative edits reach the contract,
`ensureProjectContractDraft` passes state-derived facts, and contract signing
uses optimistic concurrency + a content hash. The element system safely
redirects `act`/`saveModule` into template state in preset mode. No critical
crash-class defects were found in the audited layers.

## Fixed this pass (shipped + pushed)

1. **Marketing video autoplay cost** — a 7.5 MB clip autoplayed on load.
   `SiteVideo` now attaches its source and plays only in-viewport
   (IntersectionObserver, `preload="none"`), and honours reduced-motion.
2. **Dark-stage white flash** — `SpaceView` loading / not-found states were
   hard `bg-white`; now honour `themeMode` (no white flash, visible glyph).
3. **Dead `/showcase` link** — redirected to `/#work` (no such anchor; the
   home is a fixed inner-scroll container where a hash cannot scroll anyway),
   so both "Beispiel ansehen" CTAs were inert. Now → `/how-it-works`.

## Open candidate findings (not yet fixed) — prioritized

Severity: **M** = real usability/integrity issue worth doing; **L** = polish.

- **[M] Any share-link visitor can delete another party's uploads.**
  `app/api/spaces/[id]/state/route.ts` (edit → `deleted` path, ~L366): once a
  project is `shared`, the role gate only checks `role !== "none"`. It does not
  verify that the requester owns the upload row being deleted, so a `link`/
  `client` visitor can tombstone the photographer's uploaded set (e.g. moodboard
  references). Fix: restrict upload deletion to the uploading actor or the
  owner (compare `target.actor_id`/`actor_kind` before delete).

- **[M] Draft (stage `null`) spaces accept state writes without the owner
  token.** Same route: the access block runs only `if (space.stage)`. Anonymous
  Home drafts therefore accept `add`/`vote`/`voice`/upload-commit from anyone
  who knows the (unlisted) id, with any ≥16-char anon token. This contradicts
  the documented "private drafts require the exact per-space owner token" model
  that `/upload` enforces. Decide the intended model and make `/state` and
  `/upload` consistent.

- **[M] Hardcoded German widget-chrome strings break non-German spaces.**
  Renderers embed literal German UI ("+ Zeile hinzufügen", "Spalte benennen",
  empty-state hints) instead of resolving via the space's language/labels.
  A space whose detected language is English shows English content inside a
  German widget frame. Scope is broad (most `components/widgets/*Renderer.tsx`);
  route through `ctx.labels` / a per-language string table. (Aligns with the
  deferred i18n workstream.)

- **[L] Cryptic not-found state.** `app/s/[id]/SpaceView.tsx` renders a lone
  "—" and "←" when a space is missing/private. A real user hitting a dead or
  private share link sees no explanation. Give it a short German sentence +
  a "Zur Startseite" link.

- **[L] `draftContract` latent state-loss footgun.**
  `lib/server/contractDraft.ts:111` — `input.facts ?? buildProjectFacts(modules)`
  rebuilds facts WITHOUT `module_state` if a future caller omits `facts`. All
  current callers pass state-derived facts, so this is latent only. Consider
  requiring `facts` (or threading state) to remove the trap.

- **[L] `<html lang="de">` is static** (`app/layout.tsx:41`) while a space has
  its own language. On `/s/[id]` a non-German project is announced as German to
  assistive tech. Set `lang` per space on the project subtree.

- **[L] Moodboard marketing video has no poster.** `lib/siteMedia.ts` — the
  `moodboard` video slot has no `posterSrc`, so before it scrolls into view it
  shows an empty tinted box. Add a still poster (the `projectPage` slot already
  has one).

- **[L] Stale doc.** `AGENTS.md` still calls the `production` stage "Auswahl";
  the app now consistently labels it **"Vertrag"** (`lib/projectStages.ts` is
  canonical). Update the doc to avoid future confusion.

## Notes for the next agent

Several plausible defects were investigated and **disproved** (verified, not
assumed): preset index-remap collapse (dedup makes it unreachable), the
`production`-stage read-only lock vs. a selection widget (selection was retired
from auto-seed), `target="_blank"` links (all carry `rel`), untyped form
buttons (all typed), and broken `/media` references (all 30 assets exist).
