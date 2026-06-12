# Launch TODO — set up together when going live

Items deferred until launch. Each needs a decision or external account from Leon.

---

## 0. AI as "repertoire of emergent functions" (idea — explore later)
**Status:** parked. Doesn't touch a current principle; revisit deliberately.

Guiding rule (Leon): **AI must NOT invent facts.** It should only make the
the owner's own input more understandable/accessible through *abstraction and
structuring* — never add specifics the owner didn't say.

The shape of the idea: a small repertoire of opt-in "emergent functions" that
the app can offer on a card when they genuinely fit, e.g.:
- auto-generate a lightweight **roadmap / steps** from the owner's intent,
- propose extra **custom fields** that suit this particular kind of thing
  (a shoot wants "looks/refs", a hackathon wants "stack", a dinner wants
  "bring"),
- restructure a rambling description into a clean brief.

Open questions to resolve before building: which functions, how they're
triggered (never auto-spam), how to keep them abstraction-not-invention, and
whether they live on creation or on the detail page. Tie-in with the
"single-player value at N=0" thesis (see chat): these are owner-facing
value, available before any network exists.

---

## 1. Weekly digest email
**Status:** deferred — needs a sender email + email service.

The idea: a weekly "Paris this week" digest to each user listing live Things
matching their interest tags (and crew updates).

Blocked on:
- A sender email address / domain (e.g. `hello@magyc.site` or similar).
- An email service. GDPR-friendly EU options to evaluate at launch:
  - **Resend** (simple API, good DX, EU region available)
  - **Postmark** (transactional, reliable)
  - **Scaleway Transactional Email** (EU-native)
- A cron trigger (Vercel Cron or Supabase pg_cron) to send weekly.
- Unsubscribe handling + a `email_prefs` column on profiles.

When we do this: also wire a transactional path (e.g. "someone joined your
crew") if we add notifications.

---

## 2. Trust & safety + phone migration
**Status:** deferred — builds once real meetups start happening.

Since strangers meet physically in Paris, trust is central. Planned, in order:

1. **Report / block system**
   - `reports` table (reporter_id, target_user_id or card_id, reason, created_at)
   - Block: hide a blocked user's cards from your feed; prevent join.
2. **Phone verification (migrate from / add alongside email OTP)**
   - Primary reason: spam prevention — phone is a stronger identity gate.
   - Clerk supports phone OTP, but Production phone for DE numbers needs a
     paid Clerk plan (this is why we started with email). Revisit pricing
     at launch, or evaluate an EU SMS provider.
   - Keep email as fallback for users without a usable phone.
3. **Lightweight admin backend**
   - User list + ban toggle (set a `banned` flag on profiles; banned users
     can't post/join, their cards hidden).
   - Review queue for reports.
   - Could be a protected `/admin` route gated to specific Clerk user IDs,
     or a separate internal tool. Decide scope at launch.

---

## Notes
- Both depend on real usage volume — don't over-build before there are
  enough users and real meetups to justify the moderation surface.
- Phone migration is also a cost decision (Clerk paid plan vs. EU SMS).
