# Scoped Realtime and strict project privacy

## Why this remains a launch boundary

Historically, private project data was fetched and subscribed to by the browser
with the public Supabase anon client. The code path has now moved to authorized
server snapshots and data-free Broadcast invalidations, but the historical
database grants remain until migration 025 is applied. Until then, knowing an
unguessable project id can still bypass the application layer through direct
Supabase REST access.

Removing those policies before the code cutover would have broken initial
reads, member/share-link access, and collaboration. Migration 025 is therefore
kept manual until the deployed cutover passes the production role matrix.

## Current implementation status

- Server components and browser refreshes now read complete Spaces through
  `GET /api/spaces/[id]`; historical modules use the scoped version endpoint.
- The server checks a small access row before loading the full graph. Missing
  and forbidden projects both return 404.
- Project channels broadcast only `{ from: <tab id> }` invalidations. They no
  longer subscribe to `module_state` row changes or transport project content.
- Migration 025 is prepared but intentionally manual. It removes the historical
  public SELECT policies/grants and the old `module_state` publication after
  the production role matrix has passed.

## Target model

1. **Server-authorized initial read.** Every project graph is loaded through a
   server route or server component after resolving one of four roles: owner,
   editor, client, or explicitly enabled share-link guest.
2. **Scoped Realtime authorization.** A browser receives a short-lived project
   channel token only after the same access check. The token is scoped to one
   project and carries no service-role capability.
3. **Private database policies.** `spaces`, `module_state`, versions, messages,
   contracts, and membership rows deny anonymous table reads by default.
4. **Server-owned writes.** Config, state, upload, contract, and membership
   changes continue through validated API routes. The browser never receives a
   privileged database key.
5. **Explicit guest lifetime.** Share-link access uses a revocable, rotated
   capability with an optional expiry. A public project page must not imply
   access to the Studio account or unrelated projects.

## Recommended implementation sequence

### Phase 1: access contract

- Centralize project-role resolution in `lib/server/projectAccess.ts` for every
  read and write path.
- Add integration tests for owner, editor, client, share-link guest, signed-out
  visitor, removed member, archived project, and deleted project.
- Record access denials and token issuance in `app_events` without storing token
  values.

### Phase 2: authenticated Realtime transport

- Prefer Supabase Realtime private channels with a short-lived Clerk-backed
  Supabase JWT if the production Supabase plan supports the required claims and
  channel authorization.
- Otherwise use a server-authorized broadcast transport. The server publishes
  sanitized state/config events after successful writes; clients refetch from a
  role-gated endpoint after reconnect or sequence gaps.
- Keep optimistic local updates. Realtime is fan-out, not the source of truth.

MVP implementation: public Broadcast channels currently carry data-free
invalidations and all resulting reads are role-gated. Private channel
authorization remains a defense-in-depth upgrade; it is no longer required to
prevent project-row disclosure.

### Phase 3: read-path cutover

- Replace client-side `fetchSpaceById` table reads with a role-gated project
  snapshot endpoint.
- Remove direct browser reads for versions and any remaining project tables.
- Add reconnect recovery: compare a revision/sequence and fetch a fresh snapshot
  when events may have been missed.

The snapshot cutover is implemented. Revision/sequence-based gap detection is
still a later optimization; current invalidations refetch the complete snapshot.

### Phase 4: policy lockdown

- Apply the new RLS migration only after Phases 1-3 are deployed.
- Revoke public select policies on private project tables.
- Keep only narrowly scoped JWT policies and service-role operations.
- Verify Storage remains private and every media read uses a signed URL.

## Acceptance criteria

- Knowing a project ID is insufficient to read any private project row or file.
- Removed members lose read, write, media, contract, and Realtime access without
  waiting for a long-lived browser session to expire.
- Owner/editor/client/share-link permissions match between SSR, APIs, uploads,
  contracts, and Realtime.
- Two users can edit one project concurrently; reconnecting produces the same
  state as a fresh server snapshot.
- No service-role key or reusable project-wide secret reaches the browser.
- A policy rollback restores the prior transport without data migration.

## Rollout guard

Ship the new transport behind a server-side feature flag. Enable it for an
internal project, then one invited test account, then a small production cohort.
Only lock down RLS after direct anon reads are absent from production telemetry.
