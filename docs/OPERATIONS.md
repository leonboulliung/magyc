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
- **Admin:** `/admin` is the support surface for users, spaces, AI events,
  media usage, feature flags, and app events.

## Migration protocol

1. Read the migration file fully before applying it.
2. Run `npm run typecheck` locally before pushing.
3. Apply the SQL manually in the Supabase SQL editor.
4. Run the verification query shown in the migration or in the handoff note.
5. Run `npm run ops:backup-check` with production Supabase env vars.
6. Check `/admin` for migration warnings and event visibility.
7. Record the result in `docs/BACKLOG.md` when the session ends.

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
- Do not introduce another storage provider until media volume, CDN needs, or
  delivery-size requirements justify it. The adapter boundary is ready for that
  move.
