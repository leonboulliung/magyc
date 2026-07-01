# Quality audit — 2026-07-01

## Scope

The audit followed the complete deterministic path from Home/Studio input via
clarifications and presets into project elements, collaborative state,
`ProjectFacts`, and the contract draft. It also checked every offered element's
empty default, visible input affordances, upload handling, access gates,
TypeScript, unit tests, the optimized production build, and production
dependency advisories.

## Corrected defects

1. **Current intent lost behind presets.** Preset modules were merged before
   clarification modules and won by type. An empty preset location could erase
   the location supplied in the current creation run. `mergeSeededModules()`
   now gives explicit current answers precedence in both creation APIs.
2. **Workflow rules were truncated or stored as facts.** Preset and Studio
   rules were appended to the 1,200-character project prompt. Long prompts
   could cut them off, and internal rules leaked into `spaces.input_text`.
   Rules now have a bounded, deduplicated classifier channel and user input is
   stored unchanged.
3. **Stale clarification answers.** Clearing a custom answer kept the previous
   value in the answer map. Empty custom input now removes that answer.
4. **Contract fact contamination and omissions.** Unconfirmed location
   suggestions became contractual locations; edits to deliverable quantity,
   format and details were ignored; moodboard media was absent; historical
   poll votes were over-counted. The projection now uses confirmed locations,
   full latest edits, moodboard uploads, and one latest vote per actor.
5. **Unsafe anonymous draft uploads.** Any arbitrary long guest token could
   upload to an unstaged private space when its id was known. Private drafts now
   require the exact owner token (or signed owner). Public collaborative spaces
   retain their intended upload path.
6. **Upload type confusion and stuck UI.** The server accepted every globally
   allowed file type for every upload element, while failed image preparation
   could leave the client busy forever. MIME policy is now element-specific,
   SVG is rejected, validation runs before decoding, and preparation failures
   visibly recover.
7. **Element catalog drift.** Picker order/symbols/defaults lived inside a UI
   component. They now live in `lib/widgetCatalog.ts`; an automated invariant
   proves every offered element has an empty config that survives sanitizing.
8. **Ambiguous inputs.** Remaining generic ellipses and English editing labels
   in active widgets were replaced with explicit German actions and
   placeholders. Empty appointment dates can be cleared without throwing.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 15 files, 51 tests passed.
- `npm run build`: passed, all 39 static pages generated.
- `npm audit --omit=dev --audit-level=high`: zero known vulnerabilities.

New boundary tests cover creation precedence, workflow-rule separation,
cleared answers, element defaults, contract fact projection, latest poll votes,
moodboard media, per-element MIME restrictions, and exact draft-token access.

## Residual risk

- Home and Studio share `PromptStart` and the pure creation rules, but still
  contain parallel presentation/orchestration code for the clarification
  screen. It is tested at the data boundary but remains a UI drift risk; a
  future refactor should extract the common clarification panel without
  changing the two page shells.
- Module config writes are optimistic but not realtime; concurrent users can
  overwrite configuration changes. Collaborative module state is realtime.
- Reorder/delete state reindexing is still multi-statement rather than one
  atomic RPC.
- Real Clerk owner/editor/client concurrency, signed Storage upload/download,
  reconnect behavior and contract co-signing require the authenticated
  production role-matrix run. Unit/build success cannot substitute for that.
- Clerk production credentials and migrations 024-027 remain operational
  launch checks documented in the backlog.
