# Guide 8: Try plans and billing with Stripe (test mode)

**Time:** about 15 minutes.
**You need:** Guide 4 finished (Stripe account, `sk_test_` key in `supabase/functions/.env`,
Stripe CLI logged in). Docker running.

**Test mode** means no real money. Stripe gives you a test card number to type in.

| Plan     | Price                      | Includes                         |
| -------- | -------------------------- | -------------------------------- |
| Free     | $0                         | 10 checks a month, 1 user        |
| Pro      | $29 a month or $290 a year | Unlimited checks, up to 3 users  |
| Team     | $59 a month or $590 a year | Unlimited checks, up to 15 users |
| Business | Contact us                 | CRM and API (later)              |

Every business gets a **14-day Pro trial**, with no card needed, when it's verified. After the
trial it moves to Free, unless the owner chooses a plan.

---

## Part A: Set up the plans in Stripe

**Step 1 of 11.** In the terminal, in the `crusty_kusty` folder, add the newest tables (your data
stays):

```bash
npx supabase migration up
```

✅ **You should see:** `Applying migration ...subscriptions.sql`.

**Step 2 of 11.** Create the plans in your Stripe test account:

```bash
npm run stripe:setup-plans
```

✅ **You should see:** lines with ✔ (products, four prices, billing portal settings), then
**Done. Plans are ready in Stripe.** You can run it again any time; it won't make duplicates.

---

## Part B: Let Stripe send billing messages to your computer

**Step 3 of 11.** If the `stripe listen` terminal from Guide 4 is still open, click in it and press
**Ctrl+C** to stop it.

**Step 4 of 11.** Start it again, now with billing messages too (one long line):

```bash
stripe listen --events identity.verification_session.verified,identity.verification_session.requires_input,identity.verification_session.processing,identity.verification_session.canceled,checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

✅ **You should see:** `Ready! ... Your webhook signing secret is whsec_...`. Leave it open.

**Step 5 of 11.** Check that this `whsec_...` is the same as `STRIPE_WEBHOOK_SECRET` in
`supabase/functions/.env`. If it's different, paste the new one there and save.

**Step 6 of 11.** In another terminal in the `crusty_kusty` folder (stop it first with **Ctrl+C**
if it's already running):

```bash
npm run functions:serve
```

Leave it running.

---

## Part C: Try it

**Step 7 of 11.** Open **http://localhost:5173** and sign in as the business owner.

✅ **You should see:** on the home screen, **Pro free trial: 14 days left** (or fewer).

**Step 8 of 11.** Click the account icon (top right), then **Plan and billing**.

✅ **You should see:** **Your plan** with the trial, and the four plans. Click **Yearly** to see
yearly prices with "2 months free".

**Step 9 of 11.** Click **Choose Pro**.

✅ **You should see:** Stripe's checkout page in test mode.

**Step 10 of 11.** You type the test card yourself:

- Card number: `4242 4242 4242 4242`
- Expiry: any future date, like `12 / 34`
- CVC: any 3 digits. ZIP: any 5 digits.

Then click **Start trial** (or **Subscribe**).

✅ **You should see:** you're back in ClientShield with **Thanks! Your plan is active.** Refresh
after a few seconds: **Your plan** shows **Pro** and **Renews on** a date. Because your trial
wasn't over, Stripe waits until it ends before the first test charge.

**Step 11 of 11.** Click **Manage billing**.

✅ **You should see:** Stripe's billing page. You can switch to Team or yearly, change the card,
or cancel. Click the **back arrow** at the top left when you're done. Changes show up in
**Plan and billing** within a few seconds.

---

## What the plans change in the app

- **Free:** the 11th check in a month is refused with a message to upgrade. The home screen
  warns when 3 or fewer checks are left.
- **Users:** inviting more people than the plan allows is refused. Pending invites count too.
  People already on the team are never removed.
- **Failed payment:** the plan keeps working while Stripe retries, and **Plan and billing** asks
  the owner to update the card.
- **Canceled:** the plan lasts until the end of the paid period, then the business moves to Free.
- **Staff** can see the plan. Only the **owner** can change it.

## Going live later

The launch guide covers how to:

- run `npm run stripe:setup-plans -- --live` with the live key
- add a webhook endpoint in the Stripe dashboard for the same 8 events
- set the secrets on the hosted project

Ask your accountant about **sales tax** before launch. Stripe Tax can be switched on later
without code changes.

## If something goes wrong

| What you see                     | What to do                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| "Billing isn't set up yet"       | Run Step 2 again (`npm run stripe:setup-plans`).                                               |
| "Could not open checkout"        | Check the `sk_test_` key in `supabase/functions/.env`, then restart `npm run functions:serve`. |
| Plan doesn't change after paying | Is the Step 4 terminal open, and showing `[200]` lines? Does its `whsec_` match `.env`?        |
| `[400]` in the Step 4 terminal   | The `whsec_` in `.env` doesn't match. Copy it again from Step 4 and restart Step 6.            |
| No **Choose** buttons            | Only the owner sees them. Staff accounts can only view the plan.                               |
| "That is a LIVE key"             | `.env` has a live key. Use the test key (`sk_test_...`) on your computer.                      |
