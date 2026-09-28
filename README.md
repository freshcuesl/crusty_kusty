# Crusty Krustees

A verified incident network for service businesses. Contractors document real disputes with
real evidence, moderators verify them, and businesses get a private alert when a new booking
matches a verified incident.

**Not a blacklist. Not a revenge tool. A truth engine for the service industry.**

## Start here

- **Run it on your computer:** [docs/setup/01-run-the-app-locally.md](docs/setup/01-run-the-app-locally.md)
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
npm run check        # everything CI checks, except e2e and database tests
```
