# MAGYC Operations Runbook

This runbook covers the invisible reliability layer: data-contract safety,
Storage, observability, migration discipline, feature flags, and backup checks.

## Current foundation

- **Data contract:** `lib/contract.ts` and `docs/DATA_CONTRACT.md` define the
  public Space/Module/state shape. New spaces also carry `spaces.contract_version`
  after migration `020_operations_foundation.sql`.
- **Storage:** browser uploads use signed direct Supabase Storage uploads.
  Server code talks to Storage through `lib/server/storage.ts`; keep provider
  details there so a future R2/S3/CDN move does not touch every route.
- **Observability:** AI calls go to `ai_events`; product operations such as
  upload preparation, upload completion, and asset signing go to `app_events`.
  Both are best-effort and must never block user workflows.
- **Feature flags:** server-side operational flags live in `lib/featureFlags.ts`.
  Use `MAGYC_FEATURE_*` env vars for risky infrastructure rollouts.
- **Admin:** `/admin` is the support surface for users, plans/account status,
  one-way support tickets, read-only account inspection, spaces, media usage,
  AI events, feature flags, and app events. Account/support actions are written
  to `admin_audit_events` after migration 021.
- **Preset state/assets:** migration 022 adds `studio_presets.template_state`.
  Preset media stays private under `presets/<owner>/<preset>/…` and is copied
  to the project namespace during creation. Verify one media-heavy preset after
  applying the migration; missing 022 does not break old module-only presets.
- **Project roles + dashboard:** migration 023 adds `project_members`,
  `spaces.updated_at`, and the service-role-only
  `studio_project_summaries(user_id)` RPC. Membership rows intentionally have
  no browser RLS policy; invitations and role changes go through owner-gated
  API routes. Team members can edit open planning widgets, clients can
  collaborate and sign, and project administration remains owner-only.
- **State growth + admin rollups:** migration 024 compacts repeated item edits,
  adds indexes for project/actor state access, and provides exact per-user
  activity counters for the paginated Admin account view. The application also
  caps append-heavy state and removes private Storage objects when their upload
  entries are deleted.
- **Private project reads:** migration 025 removes broad anon/authenticated
  SELECT access from profiles, spaces, module state, and versions. Apply it only
  after the authorized snapshot APIs and data-free Broadcast invalidations have
  been verified in production, and only after migration 024.
- **Explicit project invitations:** migration 026 separates pending invitations
  from accepted memberships. Pending rows grant no access; a verified matching
  Clerk account must accept through Studio before the membership RPC creates a
  `project_members` row.

## Migration protocol

1. Read the migration file fully before applying it.
2. Run `npm run typecheck` locally before pushing.
3. Apply the SQL manually in the Supabase SQL editor.
4. Run the verification query shown in the migration or in the handoff note.
5. Run `npm run ops:backup-check` with production Supabase env vars.
6. Check `/admin` for migration warnings, support ticket visibility, and event
   visibility.
7. For migration 023, invite one Team and one Kunde account, sign in with both,
   and verify dashboard visibility plus role boundaries before launch.
8. For migration 024, edit the same checklist/note item repeatedly and confirm
   only one logical `edit` row remains; then verify Admin search/pagination and
   exact counters for that account.
9. Before migration 025, verify owner/editor/client/share-link reads, an
   anonymous Home Space, historical versions, same-account multi-tab sync, and
   upload rendering. Apply 025, repeat the same matrix, then run the included
   policy/grant verification queries.
10. For migration 026, invite one Team and one Kunde address. Confirm neither
    project appears before acceptance, decline one invite, accept the other,
    and verify only Team can advance a phase while only the owner can share,
    archive, delete, manage users or release the contract.
11. Record the result in `docs/BACKLOG.md` when the session ends.

`npm run test:prod-smoke` checks public routes and signed-out auth gates against
production. `npm run test:role-matrix` checks real owner/editor/client/private/
shared access when supplied short-lived Clerk session tokens and the two fixture
project ids documented by the script. Never commit those token values.

Manual migrations should be idempotent (`if not exists`, `on conflict`, tolerant
functions) because code may deploy before SQL is applied.

## Backup and restore discipline

`npm run ops:backup-check` is a non-destructive readiness check. It verifies
that the service role can read core tables and the `space_assets` bucket, then
writes a local JSON report to `backups/` (ignored by git).

For a real restore drill:

1. Export a Supabase backup or use Supabase point-in-time recovery in a staging
   project.
2. Restore into staging, never directly over production.
3. Run the latest migrations in order if the restored backup predates them.
4. Run `npm run ops:backup-check` against staging.
5. Open `/admin`, a recent `/studio` project, and one shared `/s/[id]` page.
6. Verify signed Storage reads by opening an upload-heavy project.

## Scale notes for the first 100 users

- Keep `space_assets` private and serve media through signed URLs.
- Watch app_events for upload/signing errors and slow operations.
- Watch `ai_events` token totals and error rates before increasing AI limits.
- Realtime is viable for MVP, but every open project tab joins a Supabase
  channel. Monitor Supabase connection/message usage once customer invites
  become common.
- Membership APIs and the Studio summary RPC are database-backed and safe for
  the initial concurrency target. Invitation emails are not sent yet: an email
  membership is stored and claimed automatically when a matching Clerk account
  signs in.
- `spaces` and `module_state` still retain historical public-read RLS policies
  because the public Space renderer reads them through the anon client. Treat
  IDs as unguessable but do not call this strict database-level privacy. A later
  hardening slice should move Space reads/realtime authorization behind scoped
  Supabase JWTs or a server/BFF before sensitive customer data is promised.
  The staged cutover and acceptance criteria are defined in
  `docs/REALTIME_SECURITY_PLAN.md`; do not tighten the policies separately from
  the read and Realtime transport migration.
- Do not introduce another storage provider until media volume, CDN needs, or
  delivery-size requirements justify it. The adapter boundary is ready for that
  move.
