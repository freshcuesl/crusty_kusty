# Launch 8: Launch checklist

Tick each line before you tell anyone about ClientShield. Do them in this order.

## Legal (with your lawyer)

- [ ] **Name cleared:** trademark search for "ClientShield".
- [ ] **Terms of Service** written: who can use it, what businesses may report, the appeal
      process, refunds and cancellation.
- [ ] **Privacy Policy** written: what is stored, how long (24 or 60 months), who sees what,
      deletion requests.
- [ ] **Consumer reporting laws:** ask whether customer checks fall under the **FCRA** or state
      consumer reporting and privacy laws (for example California's CCPA). This shapes how
      checks and disputes must work.
- [ ] **Defamation risk:** confirm the "facts, not labels" wording and the moderation rules are
      enough.
- [ ] Add the Terms and Privacy pages to the site. Ask Claude to build them from the lawyer's
      text.

## Money (with your accountant)

- [ ] **Sales tax** on subscriptions: is Stripe Tax needed?
- [ ] **Business entity and bank account** connected to Stripe.

## Security

- [ ] Two-step login is on for **every** account: Cloudflare, Supabase, Resend, Stripe, Sentry,
      GitHub and your domain email.
- [ ] Supabase: go to **Advisors**, then **Security Advisor**. It should show no errors. Ask Claude
      about any warnings.
- [ ] **https://securityheaders.com**: test `https://clientshield.example`. It should get an
      **A** or **A+**.
- [ ] **Key rotation:** has any key, token or password ever been pasted into chat, email or a
      screenshot? If yes, make a new one and delete the old one.
- [ ] The **identifier pepper** is saved in your password manager (Guide 4, Part D).
- [ ] The admin panel is behind **Cloudflare Access** (Guide 6, Part E).

## Try everything on the live site, on your phone

- [ ] Sign up, confirm your email, set up two-step login.
- [ ] **Install the app**: on iPhone, tap **Share**, then **Add to Home Screen**. On Android, tap
      **Install**.
- [ ] Submit verification documents. As admin, approve them.
- [ ] Verify your identity with Stripe (live: your real ID).
- [ ] Report a test incident with a photo. As admin, verify it.
- [ ] From a **second** test business, check that customer. Expect an alert.
- [ ] **Real payment test:** choose Pro with your own card. Then, in Stripe, go to **Payments**,
      click the payment and **Refund** it. Cancel the subscription in **Manage billing**.
- [ ] Reset your password from the sign-in page. The email should come from your domain.
- [ ] Delete the test incident, the test customers and the second test business.

## Day-to-day after launch

- **Merging a branch:** the apps update by themselves. If it changed `supabase/`, run **Deploy
  backend** (Guide 4, Part B).
- **Sentry emails:** forward them to Claude to fix.
- **Abuse flags:** check the admin dashboard every few days.
- **Backups:** Supabase keeps 7 days. Add point-in-time recovery once you have paying customers.
