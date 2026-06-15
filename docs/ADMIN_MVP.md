# MAGYC Admin MVP

This backend is intentionally read-only for the first iteration. It gives a
small operations view without adding destructive controls too early.

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

- User overview from `profiles`
- Recent spaces with direct links
- Anonymous actor activity from `module_state`
- AI events for clarify, initial classify, widget regenerate, and prompt edits
- Error status, latency, prompt/output snippets, and token fields when supplied

## Next iteration

- Enrich users with Clerk email and last sign-in
- Add filters for user, space, event type, and status
- Add admin notes or tags per user/space
- Keep the assistant chat persistent by writing every message/tool call into the
  same observability stream or a dedicated conversation table
