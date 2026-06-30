# Code and infrastructure audit — 2026-06-30

## Incident

The production Studio failed with Next.js digest `3328073650`. Vercel's exact
runtime error was:

```text
[profile] ensure fetch failed: JWT issued at future
Error: profile_fetch_failed
```

Supabase briefly rejected the service-role request because its gateway token
was ahead of the validating node. `ensureProfile()` propagated that transient
infrastructure response through the server component, so one failed profile
read replaced the whole Studio with Next.js' generic application-error page.

The shared Supabase transport now retries only this rejected, pre-execution
clock-skew response. Studio data loading has an explicit unavailable state and
an App Router error boundary, so an exhausted dependency cannot crash into a
blank framework screen.

## Scope checked

- Current `main`, recent Git history and the complete App Router/API surface.
- Auth middleware, native Clerk routes, Studio server rendering and profile
  provisioning.
- Service-role imports, project visibility/role gates and public mutation
  endpoints.
- Prompt -> clarification -> classifier -> modules, owned preset loading and
  template-state/media materialization, project facts -> contract drafting.
- Concurrent contract signing and module revision handling.
- Supabase migrations 001-026, operational scripts, Storage paths and rate
  limits.
- Production Vercel build/runtime logs for the previous seven days.
- Dependency audit, TypeScript, unit tests, optimized build and production
  smoke coverage.
- Likely parallel project folders under `Documents`, `Desktop`, `Downloads`
  and `Claude Ordner`.

No second code repository was found. `/Users/leonboulliung/Desktop/MAGYC`
contains research/media only. The configured workspace path
`/Users/leonboulliung/Documents/MAGYC` does not exist; the authoritative repo is
`/Users/leonboulliung/Claude Ordner/MAGYC`.

## Consolidation completed

- Split the browser Supabase client from a `server-only` service-role module.
  Client bundles can no longer import the admin-client factory by accident.
- Added narrow Supabase clock-skew retry, controlled Studio degradation and a
  route error boundary.
- Added native Clerk route configuration at `ClerkProvider`, independent of
  undeclared URL environment variables.
- Linked the local repository to the existing MAGYC Clerk application.
- Added optimistic concurrency to contract signatures. Concurrent signatures
  now return `409 contract_conflict` instead of overwriting one another.
- Gated Wikipedia hydration by project visibility and `modules_rev`, preventing
  private-id mutation and parallel module overwrites.
- Removed the retired GIF proxy and its externally billable/abusable API-key
  surface. Legacy stored GIF modules remain renderable.
- Removed the stale `/studio/new` placeholder by redirecting to the real
  prompt-first Studio creation surface.
- Added HSTS, frame denial, MIME sniffing protection, referrer policy and a
  restrictive permissions policy.
- Replaced database-detail responses with stable public error codes while
  preserving full causes in server logs.
- Expanded operations checks to current contracts, memberships, invitations,
  support and audit tables; expanded production smoke checks for auth, internal
  routes, retired routes and security headers.

## Architecture verdict

The core is implemented rather than mocked. Home and Studio share the intake
contract; photography domain checks run at clarification and creation; presets
are reloaded by owner/id on the server; preset module state and private media
are remapped into project rows; project facts combine module config and live
state before contract drafting. Admin routes are Clerk/admin-gated and project
inspection uses the same authorized read model.

The primary remaining risks are operational and concurrency-specific, not a
missing core product pipeline.

## Launch blockers / follow-up

1. **Clerk production instance:** Clerk Doctor confirms the MAGYC application
   has only a development instance. Vercel production currently serves
   `pk_test`/`sk_test` credentials. Create a Clerk production instance, configure
   its domains/email flow, replace both Vercel production keys together and
   repeat login/sign-up/sign-out tests before public onboarding.
2. **Migration inventory:** verify 024, 025 and especially 026 in
   `ops_migration_log`, then run `npm run ops:backup-check`. Code tolerates some
   schema lag, but secure invitation acceptance requires 026.
3. **Authenticated role matrix:** the script exists, but its short-lived Clerk
   owner/editor/client fixtures are not configured. Run the complete production
   matrix after the Clerk production cutover and migration verification.
4. **Atomic module reindexing:** module reorder/delete protects the modules
   array with `modules_rev`, but positional `module_state` reindexing still uses
   multiple database statements. Move both operations into one service-role RPC
   before high-concurrency editing; until then, a mid-operation database outage
   can require repair.
5. **Recovery drill:** the backup check validates reachability and schema, not
   restoration. Configure Supabase backups/PITR appropriate to the plan and run
   a real restore drill before storing irreplaceable client work.

The Clerk production instance and database migration verification are external
configuration steps; they cannot be completed safely by a code deploy alone.

## Production verification

Commit `99dc727` deployed successfully to Vercel (`fra1`). The expanded smoke
suite passed homepage, native sign-in, protected mutation gates, private-id
concealment, disabled `/dev`, retired `/api/gif` and all security headers.
Vercel reported no runtime errors for the deployment after testing.

Chrome was authenticated through a ten-minute, one-time Clerk sign-in token for
the existing owner account. Verified live:

- `/studio` loads the owner's active, archived and deleted projects.
- Existing account presets and settings load.
- An existing Studio project opens without a server exception.
- `/admin` loads real Clerk accounts, activity counts and project totals.
- The Admin read-only account view lists seven owner projects and their status.
- `/admin/spaces/97tDPWEG8S` loads structured project facts and its AI/data
  trace. The Admin is therefore functional, not a static mock; it is an audit
  view rather than a pixel-identical impersonation of the user's project UI.
