# Launch: start here

These guides put ClientShield on the internet with your own web address. Do them **in order**,
one at a time. Each one is short, and you can stop between them.

> **Merge every feature branch first.** The live site is built from `main`.

| #   | Guide                                                     | Time   | What you get                                  |
| --- | --------------------------------------------------------- | ------ | --------------------------------------------- |
| 1   | [Domain and Cloudflare](01-domain-and-cloudflare.md)      | 20 min | Your web address, managed by Cloudflare       |
| 2   | [Supabase production project](02-supabase-production.md)  | 30 min | The live database, with security settings     |
| 3   | [Email with Resend](03-email-resend.md)                   | 20 min | Sign-up and password emails from your address |
| 4   | [Deploy the backend](04-deploy-the-backend.md)            | 25 min | Tables and functions on the live database     |
| 5   | [Stripe live mode](05-stripe-live.md)                     | 30 min | Real payments and ID checks                   |
| 6   | [Deploy the apps](06-deploy-the-apps.md)                  | 30 min | The app and admin panel at your address       |
| 7   | [Error tracking with Sentry](07-error-tracking-sentry.md) | 15 min | An email when something breaks                |
| 8   | [Launch checklist](08-launch-checklist.md)                | 1 hour | Final checks before you tell anyone           |

## Accounts you'll create

You create every account yourself and type your own passwords. Claude can't create accounts or
type passwords for you.

- **Cloudflare:** domain and hosting. Free, plus the domain's yearly price.
- **Supabase:** Pro plan, about $25 a month.
- **Resend:** email. Free up to 3,000 emails a month.
- **Stripe:** payments. A fee per payment, no monthly cost.
- **Sentry:** error tracking. Free plan.
- **GitHub:** you already have this.

## Keep a password manager open

Every guide has secrets to save: passwords, keys and tokens. Save each one in a password manager
(1Password, Bitwarden or your browser's) **as soon as you see it**.

**Never** paste a secret into chat, email, a screenshot or any file in the `crusty_kusty` folder.

## Two kinds of settings

- **GitHub secrets** are hidden after you save them. Use them for tokens and passwords.
- **GitHub variables** stay visible. Use them only for things that are safe to show, like web
  addresses and the Supabase _publishable_ key.

Each guide says which one to use.
