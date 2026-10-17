# ClientShield architecture

A verified incident network for service businesses: evidence-backed dispute records,
human moderation, and private alerts when a new booking matches a verified incident.
It is not a blacklist and never offers public people search.

## Decisions

| Area            | Decision                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product name    | ClientShield (renamed from Crusty Krustees on 2026-10-01; repo name `crusty_kusty` only). Name to be cleared by the lawyer (trademark search).         |
| Audience        | Business owners and their staff. Customers see nothing in the app (option A).                                                                          |
| Customer portal | Option A now. The data model keeps a separate customer identity so option B (customers log in to respond and dispute) can be added without rebuilding. |
| Market          | United States only                                                                                                                                     |
| Frontend        | React + TypeScript + Vite, installable PWA (`vite-plugin-pwa`)                                                                                         |
| UI              | MUI, one shared theme (`@cs/brand`) for the app and the admin panel                                                                                    |
| Admin           | react-admin (`apps/admin`), same theme                                                                                                                 |
| Backend         | Supabase (Postgres, Auth, Storage, Edge Functions); Pro plan in production                                                                             |
| Hosting         | Cloudflare (static assets, `_headers` for security headers)                                                                                            |
| Identity checks | Stripe Identity for owners, plus business documents reviewed by a moderator                                                                            |
| Email / errors  | Resend and Sentry, added at deploy time                                                                                                                |
| Retention       | Minor disputes 24 months; fraud and chargebacks 60 months (admin-configurable)                                                                         |
| Brand           | "C" monogram shield (B) with the "Midnight and teal" palette; amber for alerts, never red                                                              |
| Future          | Invoicing and servicing (one-stop shop)                                                                                                                |

## Repository layout

```
apps/
  web/        Contractor PWA (mobile first)
  admin/      Moderator and admin panel (react-admin)
packages/
  brand/      Colors, fonts, MUI theme, logo; contrast-tested
  core/       Env validation, Supabase client, friendly errors, test fakes
supabase/
  migrations/ Database changes, applied in order
  tests/      pgTAP database tests (RLS, grants, policies)
scripts/      Developer helpers (e.g. setup-env)
docs/         This file, setup guides, workflow
```

## Security model

1. **Deny by default.** New tables, sequences and functions are unreachable from the API
   until a migration grants access on purpose (`20260927000000_security_baseline.sql`).
   A pgTAP test fails if any public table lacks row-level security, or if new tables or
   functions are reachable without an explicit grant. Every migration that adds a function the
   app calls must include its own `grant execute ... to authenticated`.
2. **MFA for everyone.** Authenticator app (TOTP) is required, with an optional backup device.
   Passkeys and recovery codes follow once Supabase marks them stable (both are experimental
   in supabase-js as of 2026-09). Sensitive tables
   require an `aal2` session in their RLS policies, so skipping the UI does not skip MFA.
3. **Blind matching.** Customer identifiers (phone, email, address, name) are normalized
   and stored as keyed HMAC hashes. Matching runs server-side; raw PII is encrypted and only
   shown to moderators when needed. Alerts require a strong match (two or more identifiers).
   Every check is rate-limited and logged to stop "hidden people search".
4. **Evidence integrity.** Private storage buckets, short-lived signed URLs, a SHA-256 hash and
   metadata extraction per upload, append-only revisions and a hash-chained audit log.
5. **Browser hardening.** Strict CSP and security headers (`apps/*/public/_headers`),
   self-hosted fonts, hidden source maps, and the app refuses admin keys in its config.
6. **Supply chain.** CI fails on high or critical `npm audit` findings, and Dependabot opens
   weekly update PRs.

## Accounts (implemented)

| Table              | Purpose                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `profiles`         | Name per user, created automatically at sign-up                                            |
| `businesses`       | Name and `verification_status` (starts `unverified`)                                       |
| `business_members` | Who belongs to which business, as `owner` or `staff`. One business per user.               |
| `business_invites` | Staff invites. Only a SHA-256 hash of the link token is stored; links expire after 7 days. |
| `platform_roles`   | `moderator` or `admin`. Granted only by server tools (`npm run make-admin` locally).       |

Every table has a **restrictive** policy that requires an `aal2` (two-step) session, so a
password alone reads nothing. Writes go through checked functions: `create_business`,
`create_invite`, `accept_invite`, `team_members`, `remove_member` and `my_platform_role`.

Sign-in funnel (`apps/web/src/auth/authStep.ts`): sign in → set up or enter authenticator code →
create or join a business → app. The admin panel additionally requires a platform role.

## Business verification (implemented)

Flow: `unverified` → owner adds phone, address and at least one proof document → submits →
`pending` (details and documents locked) → a moderator approves (`verified`), asks for more
information (`needs_info`, note required) or rejects (`rejected`, note required). Owners can fix
and resubmit after `needs_info` or `rejected`.

- **Documents** live in the private `business-documents` bucket at `<business id>/<random name>`
  (PDF or photo, 10 MB max). There's no update policy, so a file can't be replaced after upload.
  Each document row stores the file's SHA-256 fingerprint, computed in the browser. The admin
  "Check" button downloads the file and compares the fingerprints to detect tampering.
- **Audit trail:** `verification_events` records every step and can't be edited or deleted
  by clients.
- **Gating:** `private.is_my_business_verified()` is the check future features (customer checks,
  incident reports) build their RLS on. The app also locks those screens until verified.
- **Admin:** react-admin reads through a read-only data provider; decisions go through
  `review_business()`. Documents open through signed links that expire after 5 minutes.
- **react-admin note:** don't use `<Admin requireAuth>`. In react-admin 5.15 it re-renders
  forever for signed-out visitors (blank page). `apps/admin/e2e` guards this in a real browser.

## Owner identity (implemented)

Stripe Identity checks a government ID plus a live selfie on Stripe's own page.

- `create-identity-session` (Edge Function) is for signed-in owners with two-step login only.
  It allows 5 attempts a day. It builds the return address on the server from `APP_URL`, so it
  can't be used to redirect people elsewhere.
- `stripe-webhook` (Edge Function, no JWT) accepts only messages with a valid Stripe signature
  (`STRIPE_WEBHOOK_SECRET`), and records the outcome via `record_identity_result()`, which only
  the service role can run. A verified result is final.
- Stored: Stripe session id, status and error code. **Never** ID images, numbers or birth dates.
- Submission requires a verified owner, and approval re-checks it.
- Logic lives in `supabase/functions/_shared/identity.ts` (Vitest). Entry files are
  type-checked with `npm run functions:check` (Deno) in CI.
- Local without Stripe: `npm run dev:verify-identity -- email` (local database only).

## Incidents (implemented)

Flow: `draft` → submit (needs at least one piece of evidence) → `submitted` (locked) →
a moderator chooses `evidence_verified`, `needs_info` (note required; reporter edits and
resubmits) or `rejected` (note required). Moderators confirm the job, the dispute and the evidence
exist. They never decide who was right.

- **Who can report:** members (owner or staff) of a **verified** business, with two-step login.
  Abuse guard: 50 reports per 30 days per business.
- **Customer details:** stored in `incident_customers`. Only the reporting business and
  moderators can read them.
- **Evidence:** the private `incident-evidence` bucket, at
  `<business id>/<incident id>/<random name>`, 15 MB, PDF or photo. Files can't be replaced, and
  each carries a SHA-256 fingerprint that moderators can check.
- **Expiry:** set when verified. Chargebacks and fraud expire after 60 months, everything else
  after 24.
- **Matching fingerprints:** written when an incident is verified, into `incident_identifiers`.
  Each one is an HMAC-SHA256 of the normalized name, phone, email or address, keyed with
  `identifier_pepper` in Supabase Vault. The table has no API access. Normalization lives in
  `private.normalize_identifier` (for example "Street" becomes "st", and plus-tags are removed
  from email addresses).

## Customer matching (implemented)

- `check_customer(p_customer)` checks a customer without saving them. `add_customer(p_customer)`
  saves the customer in the business's private `customers` table and checks them. Only verified
  businesses with two-step login can do either.
- The details entered are normalized and fingerprinted exactly like incident identifiers.
  An incident matches only if it is `evidence_verified`, not expired, and **at least two**
  fingerprints agree.
- Results come from `private.incident_facts`: dispute category, service month, evidence count and
  kinds, Google rating, outcome and expiry month. They never include the customer, the reporting
  business or incident ids. `match_alert_incidents` has no API access.
- Every check is logged in `customer_checks` (which kinds of detail were given, never the values),
  with a limit of 300 a day per business. Matches create a `match_alerts` row for that business
  only. `respond_to_alert` records the choice: continue booking, require authorization or decline.
- `alert_details` recomputes facts when an alert is opened, so expired incidents drop out.

## Data model direction

Two separate layers, joined only through the blind matching check:

- **Private workspace (per business):** customers, jobs, invoices (future), private notes.
  Only that business's members can read it.
- **Shared incident network:** verified incidents, evidence and moderation state, keyed to a
  hashed customer identity rather than a readable profile.

A separate `customer_identity` concept keeps option B possible: a customer can later claim an
identity after verification and respond to incidents about it.

Incident statuses: `submitted` → `evidence_verified` or `disputed`, plus `resolved` and
`expired`. Moderators confirm the job, the dispute and the evidence exist. They never
decide who was right.

## Testing strategy (test-driven development)

| Layer                         | Tool                                | Location                             |
| ----------------------------- | ----------------------------------- | ------------------------------------ |
| Units and components          | Vitest + React Testing Library      | `**/*.test.ts(x)`                    |
| Database, RLS, grants         | pgTAP                               | `supabase/tests/database`            |
| Edge functions                | Deno test                           | `supabase/functions/**` (when added) |
| End to end, phone and desktop | Playwright + axe accessibility scan | `apps/web/e2e`                       |

Every change starts with a failing test. CI runs all layers on every push.

## Roadmap (one branch each)

1. `setup/project-foundation`: this branch
2. `feature/auth-mfa`: sign-up, sign-in, required MFA, roles, staff invites, admin login
3. `feature/business-verification`: onboarding, Stripe Identity, documents, admin queue
4. `feature/incidents`: incident records, evidence, moderator review, fingerprints (done)
5. `feature/blind-matching`: normalization, hashing, alerts, incident cards
6. `feature/private-notes-retention-abuse`: notes, expiration rules, abuse detection
7. `feature/subscriptions`: Stripe billing tiers
8. `feature/analytics`
9. `feature/crm-integrations` and later invoicing
10. `feature/passkeys-recovery-codes`: when Supabase marks them stable
