# Crusty Krustees architecture

A verified incident network for service businesses: evidence-backed dispute records,
human moderation, and private alerts when a new booking matches a verified incident.
It is not a blacklist and never offers public people search.

## Decisions

| Area            | Decision                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product name    | Crusty Krustees (repo name `crusty_kusty` only)                                                                                                        |
| Audience        | Business owners and their staff. Customers see nothing in the app (option A).                                                                          |
| Customer portal | Option A now. The data model keeps a separate customer identity so option B (customers log in to respond and dispute) can be added without rebuilding. |
| Market          | United States only                                                                                                                                     |
| Frontend        | React + TypeScript + Vite, installable PWA (`vite-plugin-pwa`)                                                                                         |
| UI              | MUI, one shared theme (`@ck/brand`) for the app and the admin panel                                                                                    |
| Admin           | react-admin (`apps/admin`), same theme                                                                                                                 |
| Backend         | Supabase (Postgres, Auth, Storage, Edge Functions); Pro plan in production                                                                             |
| Hosting         | Cloudflare (static assets, `_headers` for security headers)                                                                                            |
| Identity checks | Stripe Identity for owners, plus business documents reviewed by a moderator                                                                            |
| Email / errors  | Resend and Sentry, added at deploy time                                                                                                                |
| Retention       | Minor disputes 24 months; fraud and chargebacks 60 months (admin-configurable)                                                                         |
| Brand           | Crab mascot (B) with the "Toasted trust" palette                                                                                                       |
| Future          | Invoicing and servicing (one-stop shop)                                                                                                                |

## Repository layout

```
apps/
  web/        Contractor PWA (mobile first)
  admin/      Moderator and admin panel (react-admin)
packages/
  brand/      Colors, fonts, MUI theme, logo; contrast-tested
supabase/
  migrations/ Database changes, applied in order
  tests/      pgTAP database tests (RLS, grants, policies)
scripts/      Developer helpers (e.g. setup-env)
docs/         This file, setup guides, workflow
```

## Security model

1. **Deny by default.** New tables, sequences and functions are unreachable from the API
   until a migration grants access on purpose (`20260927000000_security_baseline.sql`).
   A pgTAP test fails if any public table lacks row-level security.
2. **MFA for everyone.** TOTP authenticator apps first, passkeys next. Sensitive tables
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
2. `feature/auth-mfa`: sign-up, sign-in, required MFA, roles
3. `feature/business-verification`: onboarding, Stripe Identity, documents, admin queue
4. `feature/incidents-evidence`: incident records, uploads, integrity and audit
5. `feature/moderation`: react-admin review workflow
6. `feature/blind-matching`: normalization, hashing, alerts, incident cards
7. `feature/private-notes-retention-abuse`: notes, expiration rules, abuse detection
8. `feature/subscriptions`: Stripe billing tiers
9. `feature/analytics`
10. `feature/crm-integrations` and later invoicing
