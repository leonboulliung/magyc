# magyc.site — Data Contract

**Version:** 1.6.0 (see `CONTRACT_VERSION` in `lib/contract.ts`)

This document is the stable interface of a space. The **presentation
layer** (renderers, animations, the style system, the grid) may change
freely. The **data shapes** below change only deliberately — and when
they do, bump `CONTRACT_VERSION` and update this file.

This is the surface a future MCP bridge / export / import binds to. It
is intentionally frozen *before* MCP exists so that UX iteration cannot
silently break it. `lib/contract.ts` carries compile-time guards that
fail the build if a widget type or state kind is added to the union
without being recorded here.

---

## 1. Space

```ts
Space {
  id: string                 // 10-char slug, also the URL
  contractVersion: string    // persisted row contract version; older rows may report 1.5.0
  inputText: string          // the original seed text
  title: string              // AI headline
  language: string           // ISO 639-1; the space's only "language"
  vibe: Vibe                 // editorial|document|dashboard|terminal|soft|minimal
  stage: "brief" | "production" | "handoff" | null
                              // Creator-Suite lifecycle; null for anonymous spaces
  segment: string | null      // guided project/preset segment, e.g. "product"
  shared: boolean             // unlisted Studio sharing flag
  archivedAt: number | null   // archived Studio project timestamp
  deletedAt: number | null    // soft-delete timestamp; restorable for 30 days
  modules: Module[]          // ordered; first 1-3 are the header zone
  labels: SpaceLabels        // emergent UI strings in `language`
  style: SpaceStyle | null   // font + 3 colors; auto-assigned, editable
  owner: Profile | null      // set at publish
  visibility: "public" | "password" | null   // null = draft
  state: ModuleStateEntry[]  // collaborative actions
  versions: SpaceVersion[]   // snapshots; v1 = publish moment
  createdAt: number
  publishedAt: number | null
}
```

`SpaceStyle = { font, color1, color2, background }`
- `color1` — ink: text, borders, map pins
- `color2` — accent: widget highlights, map fills/routes
- `background` — page canvas (the element grid stays white regardless)

`SpaceLabels` — all optional, all in `language`. Includes
`widgetLabels: Record<ModuleType, string>` for the add-widget menu.

Creator Suite note: the internal lifecycle values remain
`brief | production | handoff` for compatibility. The Studio UI labels
them as **Planung / Auswahl / Abgeschlossen**.

---

## 2. Module zones

The `modules` array is ordered. The **header zone** is the leading run
of `heading`, `rich_text`, `tags` (each at most once, in that order).
Everything after is the **body** — what the grid renders.

| Zone   | Types                          | Notes |
|--------|--------------------------------|-------|
| header | `heading`, `rich_text`, `tags` | always present, not in grid |
| body   | the other 30                   | 2–6 chosen by the classifier |

---

## 3. The 33 widget types

Each is a discriminated member of `Module`, keyed by `type`. Every
widget may carry optional `microTitle`, `description`, `attribution`.

### Header
- `heading` — `{ text, level: 1..6 }`
- `rich_text` — `{ text, placeholder? }`
- `tags` — `{ tags: string[] }`

### Reference / framing
- `wikipedia` — `{ topic, url?, thumbnailUrl?, extract? }` (resolved server-side)
- `ai_summary` — `{ text }`
- `icon` — `{ iconify: "set:name" }`

### Place (mandatory-config; coords resolved by geocoder)
- `location_single` — `{ center: [lng,lat], zoom?, label? }`
- `locations_multi` — `{ locations: {lng,lat,label?}[] }`
- `location_suggestions` — `{ suggestions: {label,address?,lng?,lat?}[] }` (text + votes, no map)
- `route` — `{ stops: {lng,lat,label?}[] }`

### Time
- `date` — `{ date: "YYYY-MM-DD" }`
- `appointment` — `{ datetime: ISO, timezone? }`
- `appointments` — `{ entries: {datetime,label?}[] }`
- `range` — `{ unit, from, to }`

### Team / work
- `crew` — `{ roles: {name}[] }`
- `work_packages` — `{ packages: {label,description?}[] }`
- `deliverables` — `{ items: {label,details?,quantity?,format?,due?,status?}[] }`

### Collaboration (mostly state-driven)
- `notes` — `{ placeholder? }`
- `qa` — `{ placeholder?, questions?: {text,answerHint?}[] }`
- `poll` — `{ question, options: string[] }`
- `discussion` — `{ placeholder? }`
- `approvals` — `{ items: {text,description?,due?,audience?,status?}[] }`

### Visualisation
- `phases` — `{ phases: {label,description?}[], currentPhase }`
- `checklist` — `{ items: {text}[] }`

### Uploads (Supabase Storage)
- `attachments`, `images`, `audio` — `{ placeholder? }`
- `moodboard` — `{ placeholder?, directions: {label,note?,status?}[] }`
- `selection` — `{ placeholder? }` — post-shoot proofing-lite. Photos are
  owner `upload`s; collaborators select via `check` (itemKey = upload id) and
  comment via `voice` (parentId = upload id). Added in the Auswahl stage, not
  authored by the classifier.

### Specialty
- `sketch` — `{ placeholder? }`
- `table` — `{ columns: string[], rows: string[][] }`
- `shot_list` — `{ shots: {label,purpose?,setup?,location?,notes?,priority?,status?}[] }`
- `parts_list` — `{ items: {name,quantity?,imageUrl?}[] }`
- `gif` — `{ gifUrl, thumbnailUrl? }`

Coercion: every shape is normalised by `sanitizeModule()`; malformed
widgets are dropped, not trusted.

---

## 4. Collaborative state vocabulary

`ModuleStateEntry { id, spaceId, moduleIndex, actor, kind, data, createdAt }`

`actor = { kind: "user"|"anon", id, displayName?, color? }`

| kind     | widgets                         | data shape |
|----------|---------------------------------|-----------|
| `vote`   | poll, location_suggestions      | `{ option }` — empty = retract |
| `check`  | checklist, approvals            | `{ itemKey, checked }` |
| `claim`  | crew, work_packages, deliverables, approvals | `{ slotLabel, claimed? }` — false = release |
| `voice`  | qa, discussion                  | `{ id, text, role?, parentId? }` |
| `edit`   | notes, table, shot_list, deliverables, approvals | `{ id?, text?, status?, due?, ... }` (last-write-wins) |
| `add`    | notes, checklist, shot_list, deliverables, approvals, parts_list, … | free per widget (e.g. `{ id, text }`) |
| `upload` | attachments, images, moodboard, selection, audio | `{ url, name, size?, mimeType?, path? }` |
| `stroke` | sketch                          | `{ path, color?, width? }` |

Every action snapshots `data.color` (the actor's accent) so attribution
survives without a profile lookup.

---

## 5. Compose pipeline

```
text + clarify-answers
  → clarify()   : 2–5 MC questions (general | data), space language
  → analyze()   : language + title + vibe + score(0-10) for each body type
  → select()    : deterministic server-side pick (threshold, group caps)
  → author()    : header + body configs + labels + style + widgetLabels
  → resolve     : geocode map place-names → coords; hydrate Wikipedia
  → Space
```

Selection is a **pure function of independent per-module scores** — no
LLM picks the final set, which is what keeps module choice unbiased and
reproducible.

---

## 6. Change policy

- **Additive** (new optional field, new widget, new state kind):
  minor version bump, update §3/§4, no consumer breakage.
- **Breaking** (rename/remove a field, change a `data` shape, reorder
  zones): major version bump, and any MCP/export layer must be updated
  in lockstep.

The compile-time guards in `lib/contract.ts` make additions impossible
to forget; this document makes them legible.
