# ClientShield

A verified incident network for service businesses. Contractors document real disputes with
real evidence, moderators verify them, and businesses get a private alert when a new booking
matches a verified incident.

**Not a blacklist. Not a revenge tool. A truth engine for the service industry.**

## Start here

- **Run it on your computer:** [docs/setup/01-run-the-app-locally.md](docs/setup/01-run-the-app-locally.md)
- **No Docker? Use the free cloud test database:** [docs/setup/01b-cloud-test-database.md](docs/setup/01b-cloud-test-database.md)
- **Try sign-up and two-step login:** [docs/setup/02-try-sign-in-locally.md](docs/setup/02-try-sign-in-locally.md)
- **Try business verification:** [docs/setup/03-try-business-verification.md](docs/setup/03-try-business-verification.md)
- **Connect Stripe Identity (test mode):** [docs/setup/04-connect-stripe-identity.md](docs/setup/04-connect-stripe-identity.md)
- **Report and review an incident:** [docs/setup/05-try-an-incident-report.md](docs/setup/05-try-an-incident-report.md)
- **Try customer matching and alerts:** [docs/setup/06-try-customer-matching.md](docs/setup/06-try-customer-matching.md)
- **Try customer records, notes, retention and abuse flags:** [docs/setup/07-try-notes-retention-abuse.md](docs/setup/07-try-notes-retention-abuse.md)
- **Try plans and billing (Stripe test mode):** [docs/setup/08-try-plans-and-billing.md](docs/setup/08-try-plans-and-billing.md)
- **How the system is built:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **How changes get merged:** [docs/WORKFLOW.md](docs/WORKFLOW.md)
- **Security:** [SECURITY.md](SECURITY.md)

## Quick commands

```bash
npm install          # once
npm run db:start     # start the local database (Docker must be running)
npm run setup:env    # connect the apps to the local database
npm run dev          # contractor app  → http://localhost:5173
npm run dev:admin    # admin panel     → http://localhost:5174
npm run make-admin -- you@example.com   # make a local account a moderator
npm run stripe:setup-plans               # create the plans and prices in Stripe (test mode)
npm run check        # everything CI checks, except e2e and database tests
```
