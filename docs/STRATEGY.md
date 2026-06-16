# MAGYC — Product Strategy & PMF Compass

_Last updated: 2026-06-16 (Claude; rev. with staggered segment-page model,
§11). This file is the binding strategic compass. If a decision here changes, update this file in the same commit and
note it in `docs/BACKLOG.md`. Engineering decisions should trace back to a
line in this document._

This consolidates the pivot from a horizontal "idea → structure page" toy into
a vertical, sellable product. It is grounded in the market analysis
*"Berufsrealität professioneller Fotografie und die dominante
Softwarelandschaft"* (Leon, June 2026) and a full review of the current
codebase.

---

## 1. The core thesis — one engine, two intents

MAGYC is **not** "a planning tool" plus "a presentation tool." It is **one
generative engine** (prompt / structured data → custom adaptive elements) that
re-expresses the **same accumulated project data** for different intents:

- **Intent "structure"** (intake / planning): location, date, goal,
  participants, deliverables are *captured and coordinated*.
- **Intent "present"** (recap / delivery): the *same* data is re-composed —
  via preset + AI — into a finished, media-ready hand-off page.

The data is entered **once** (or ingested from the client's email) and flows
through the whole lifecycle without ever being re-typed.

**Why this is the moat:** every incumbent (Pixieset, HoneyBook, Pic-Time,
Studio Ninja) is a *fixed template*. Photographers re-type the same client,
date, location, and deliverables into 2–6 tools per project (the market
analysis: *"zwei bis sechs Werkzeuge"*). None of them has a generative
adaptive engine that spans briefing → delivery. MAGYC already has that engine
(`lib/server/classify.ts`).

---

## 2. The sales promise

Not "AI builds you a page." The promise is:

> **Enter the project once — MAGYC carries it from the brief to the finished
> presentation. You never re-type the same client, location, or deliverable
> again.**

This attacks the pain the analysis names directly: *"die Marge wird in
unsichtbaren Prozessschritten gemacht oder verloren"* — acquisition, usage
definition, approvals, delivery configuration.

---

## 3. Beachhead — Commercial / Product photography

Decision: **Commercial / Product, not Wedding.** First sellable workflow is
built for this segment only. Rationale (from the analysis):

1. **The bottleneck fits our foundation.** Commercial is *"briefing-intensive,
   agency/brand alignment, set approvals, exact deliverables and rights"* —
   exactly `deliverables`, `approvals`, `crew`, `work_packages`. It is a
   **coordination** load, not a **gallery** load.
2. **Module 3 is most valuable here.** An auto-generated project
   *presentation* page serves the brand client (clean hand-off / case study)
   **and** the photographer (portfolio / acquisition). For wedding it would
   just be "a pretty gallery" — Pixieset's strongest, most capital-intensive
   home turf.
3. **It avoids a frontal assault.** Wedding forces bulk galleries, print-lab
   networks, volume storage — the incumbents' moat. Commercial lets us win on
   the *intelligence* layer, where nobody sits.

Wedding is the bigger market — but as the **second** step, after the engine is
proven on Commercial.

---

## 4. Where we do NOT play (discipline)

- **RAW / editing / tethering / color** — stays desktop-bound (Lightroom,
  Capture One). Unwinnable, capital-intensive, not our game. MAGYC never
  touches the image itself.
- **The proofing gallery as core infrastructure** — storage, hi-res delivery,
  stores, print labs. That is Pixieset's castle. Keep any gallery **light**
  (selection / feedback on photographer-uploaded previews) and *integrate or
  link* later rather than rebuild it.

MAGYC's center of gravity: **briefing intelligence + lifecycle continuity +
auto-presentation.** Everything else is incidental or an integration.

---

## 5. The biggest positioning risk — GenAI anxiety

The analysis is blunt: **58% of photographers already report lost commissions
to GenAI**, while **68% use AI weekly — but for *efficiency*, not as a
replacement for creative authorship** (VSCO 2026).

A pitch like "AI generates your client presentation" hits that anxiety
head-on. MAGYC must be positioned, without exception:

> **The AI does the busywork and the scaffolding — you keep the craft, the
> images, and the final word.**

Never "AI creates." Always "AI saves you the invisible hours between shoots."
This matches the analysis's most durable AI use cases (admin help, time
savings) and is exactly what Module 3 does: it *re-structures existing data*,
it does not invent images.

---

## 6. Competitive map (one line each)

- **Pixieset / Pic-Time / SmugMug** → gallery + delivery + store. MAGYC
  *complements* them (the hand-off), does not replace them.
- **HoneyBook / Studio Ninja** → CRM + contracts + invoicing (fixed
  templates). MAGYC is the adaptive *project brain* in front of them — and can
  feed them.
- **MAGYC's open position:** the layer that *understands* the project and
  carries it across phases — from the inbound client email to the finished
  presentation. Nobody holds it, because nobody has a generative adaptive
  engine. We already built it.

**Price anchor:** incumbents sit at €12–48/month. MAGYC can slot in at
€20–40/month **if** the "enter once, use everywhere + finished presentation"
promise delivers a real tool-switch / time saving.

---

## 7. The 3-module product (and the first sellable slice)

Full vision, in lifecycle order:

- **Module 0 — Lifecycle + roles (prerequisite).** A `stage` field on the
  space (intake → planning → shoot → post → delivery) + per-stage module sets;
  re-author for a stage given accumulated state. Roles: photographer (account)
  · client (invited guest) · optional team. *Biggest single architectural
  addition; the current model is a flat, one-shot module list and an
  anon-owner-until-publish identity model that is backwards for a paid SaaS.*
- **Module 1 — Intake from email → briefing page (~80% exists).** Inbound mail
  plumbing (Postmark/Mailgun/SendGrid inbound → webhook → classify the thread).
  The classifier already turns text → structure. Differentiator: a **usage &
  rights** building block (where margin leaks).
- **Module 2 — Post-shoot review (new stage + a light gallery).** Selection /
  favorites / per-photo comments / approvals. The `module_state` primitives
  (`vote`/`check`/`voice`/`upload`) already fit; the gallery widget itself is
  the heavy part. **Deliberately deferred** — it is where we'd collide with
  Pixieset.
- **Module 3 — Auto-presentation (the wow).** Same project data → a branded,
  media-ready recap / hand-off page via preset + AI. Photographer tweaks
  colors / text; otherwise done. This is the demo, the sales moment, the
  differentiator nobody else has.

### First sellable slice (recommended build order)

A narrow, deep vertical for Commercial / Product:

1. **Intake:** client email → briefing page (deliverables + rights + date +
   location). ~80% there.
2. **One lifecycle transition:** photographer clicks "finish project" → same
   data →
3. **Module 3:** auto-generated, branded presentation / hand-off page.

**Skip Module 2 (proofing) for now** — heaviest to build and most likely to
collide with incumbents. The magic nobody has is "project data → finished
presentation in one click." That is the demo.

---

## 8. Architecture verdict (can we build on it?)

Yes — solid, extensible foundation, no rewrite needed.

- **Strengths:** clean two-state-plane model (`spaces.modules` config vs
  append-only `module_state` event log) maps perfectly onto
  photographer-owns-structure / client-interacts; a clean two-stage classifier
  (scoring → deterministic server selection → authoring) with no position
  bias; frozen, documented data contract; AI observability.
- **Gaps the pivot requires (see Module 0):** no space-level lifecycle/stage;
  binary owner/visitor roles (must invert to account-first photographer +
  invited client); no email intake; `images`/`attachments` are simple
  uploaders, not a proofing gallery; lost-update races on config (BACKLOG #3/4)
  matter more once money is attached.

---

## 9. Honest read on trajectory

Engineering quality is high. The risk is **breadth over depth**: 31 widgets, 5
project modes, a full marketing scaffold, admin, assistant dock — lots of
surface, but no single workflow taken to "a photographer pays for this and it
saves hours." The generic "any idea → structure" positioning has no buyer; the
analysis confirms buyers pay for *specific bottlenecks*. The pivot instinct is
right; the discipline now is to build **one slice deep enough to sell** without
rebuilding the capital-intensive parts incumbents already nailed.

---

## 10. Open validation step (highest leverage, not code)

Before building Module 0, talk to 3–5 commercial/product photographers and ask:
*"How many tools do you re-type the same project data into, and how long does
it take to turn a finished shoot into a presentable hand-off / case study?"*
If the answer is "2–4 tools, several hours" → PMF signal. If "that's quick
already" → sharpen the position before investing months.

---

## 11. Marketing site — segment pages as staggered acquisition doors

The product/engine is **horizontal**: the lifecycle (brief → produce →
present) and most building blocks (deliverables, crew, schedule, location,
approvals, shotlist, moodboard) are shared across product, corporate, event
and wedding. So segment landing pages are worth preparing — each is a distinct
search intent (SEO) and ad target, and a low-cost clone of one template.

**But the message must differ by bottleneck, not by word.** The analysis's
core finding holds: software choice follows the segment's bottleneck. A page
that only swaps "wedding" for "product" would be weak — and worse, a wedding
page implicitly promises proofing galleries, our deliberate non-feature (§4).

Therefore: build the **capability** to spin up segment pages, but roll them
out **staggered**, ordered by adjacency to our strengths, keeping one primary
so the conversion signal stays clean:

1. **Product / Commercial** — primary beachhead (`/product`, real imagery).
2. **Corporate** — closest adjacent: coordination-heavy (many stakeholders,
   multi-location scheduling, usage rights, consistency), light gallery load
   (`/corporate`, imagery pending).
3. **Event** — speed/bulk; delivery matters more. Later.
4. **Wedding** — biggest market but most gallery/volume-dependent; furthest
   from current strengths, highest over-promise risk. Last, ideally only once
   the delivery/gallery (Module 2) story is real.

Implementation (built 2026-06-16): a data-driven `Segment` model
(`lib/segments.ts`) + one renderer (`components/site/SegmentLanding.tsx`).
Each segment is a thin wrapper page (`app/(site)/<slug>/page.tsx`) and links
to the others. Imagery is optional — missing images render labelled
placeholders. This **supersedes** the earlier "generic `for/[area]` doesn't
fit" note: a per-bottleneck, staggered segment IA is the right model; the old
generic `for/[area]` pages should be retired/redirected onto this.

---

## 12. Creation UX — guided over prompt (Leon, 2026-06-16)

The free-text prompt → clarify → classify flow is a **quick path and a nice
homepage preview/demo** — it should NOT be the primary way to create in the
actual Creator Suite. Leon's observation: the homepage presets and clickable
example texts hint that there are **even easier, click-based** ways to start a
project — *click "Wedding" → click x → click y → done, no thinking, no
prompting*.

**Direction:** the suite's primary creation path is a **guided, segment-first
builder** (pick segment → a few structured choices → a fully-formed project),
not a blank prompt box. This maps directly onto the existing project modes
(`lib/projectModes.ts`) and the segment model: a wedding builder pre-seeds the
wedding lifecycle + building blocks, the photographer just answers a few clicks.
The prompt flow stays available (and on the marketing landing as the wow demo),
but in the product it's the secondary/"power user" path.

Consequence for the marketing segment pages: their CTA should eventually lead
into the **guided builder for that segment**, not the generic prompt. (Not
built yet — captured here so the IA and CTAs are designed with it in mind.)
