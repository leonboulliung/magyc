# MAGYC Admin MVP

This backend is the launch operations cockpit. It combines read-only product
understanding with a small number of deliberate account/support actions.

## Enable access

Set at least one of these deployment environment variables:

```bash
ADMIN_EMAILS=you@example.com,second@example.com
ADMIN_USER_IDS=user_...
```

If neither variable is set, `/admin` stays locked and shows an explicit setup
message. Signed-out visitors only see the sign-in gate.

## Enable AI logs

Apply the migration in Supabase:

```text
supabase/migrations/009_ai_events_admin.sql
```

The app logs AI calls on a best-effort basis. If the migration is missing or
Supabase is temporarily unavailable, user-facing generation still works and the
server logs a warning instead.

## Current scope

- Launch metrics: users, active users, spaces, open support tickets, media, and
  error counts.
- User overview from `profiles` enriched with Clerk email addresses.
- Plan and account-status changes (`active`, `locked`, `banned`). Clerk remains
  the source of truth for the actual lock/ban; Supabase stores the operational
  snapshot.
- Read-only account view: projects, support tickets, and a user activity
  timeline from `spaces`, `module_state`, `ai_events`, `app_events`, and
  `support_tickets`.
- One-way support intake: signed-in users submit tickets from Studio/project
  surfaces; the admin marks them done and communicates manually by email.
- Admin audit events for account and ticket actions.

## Required migration

Apply the migration in Supabase:

```text
supabase/migrations/021_admin_support_and_account_ops.sql
```

It adds profile plan/status fields plus `support_tickets` and
`admin_audit_events`.

## Next iteration

- Filters for user, space, event type, and status.
- Better support workflow if launch volume requires it: replies, email
  notifications, assignment, SLA states.
- Higher-fidelity read-only account inspection for individual project modules
  if the current project/timeline view is not enough.
