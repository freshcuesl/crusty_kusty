# Launch 5: Stripe live mode

**Time:** about 30 minutes, plus Stripe's review of your business.

Until now you used **test mode**. Live mode takes real money and checks real IDs.

> **Live keys are the most sensitive secrets you have.** They go in only two places: Supabase
> **Edge Functions → Secrets**, and the one command in Step 6. Never into a file, chat or
> screenshot.

---

## Part A: Activate your Stripe account

**Step 1 of 12.** In the Stripe dashboard, turn **Test mode** **off**. Click **Activate payments**
(or **Complete your profile**). Enter your business details, your bank account for payouts, and
your own ID. Only you can do this.

✅ **You should see:** Stripe says your account can accept payments. Sometimes Stripe asks for more
details first.

**Step 2 of 12.** In Stripe's settings, turn on two-step authentication for your login.

**Step 3 of 12.** In live mode, search for **Identity**. If Stripe asks you to apply for Identity in
live mode, follow its steps.

---

## Part B: Create the plans in live mode

**Step 4 of 12.** In Stripe (live mode), go to **Developers**, then **API keys**. Next to **Secret
key**, click **Reveal**. Leave this page open.

**Step 5 of 12.** Open a **new PowerShell terminal** in the `crusty_kusty` folder.

**Step 6 of 12.** Type the line below. Paste your live key in place of `PASTE_LIVE_KEY` and keep the
quotes. Press **Enter**.

```powershell
$env:STRIPE_SECRET_KEY="PASTE_LIVE_KEY"; npm run stripe:setup-plans -- --live
```

✅ **You should see:** ✔ lines, then **Done. Plans are ready in Stripe.**

**Step 7 of 12.** **Close that terminal window**, so the key disappears from it.

---

## Part C: Connect Stripe to the live functions

**Step 8 of 12.** In Stripe (live mode), go to **Developers**, then **Webhooks**, then **Add
endpoint**:

- **Endpoint URL:** `https://<project ID>.supabase.co/functions/v1/stripe-webhook`
- **Events:** click **Select events** and tick these 8:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `identity.verification_session.verified`
  - `identity.verification_session.requires_input`
  - `identity.verification_session.processing`
  - `identity.verification_session.canceled`

Click **Add endpoint**.

**Step 9 of 12.** On the new endpoint's page, under **Signing secret**, click **Reveal**.

**Step 10 of 12.** In Supabase, go to **Edge Functions**, then **Secrets**. Add:

| Name                    | Value                                     |
| ----------------------- | ----------------------------------------- |
| `STRIPE_SECRET_KEY`     | the live secret key from Step 4           |
| `STRIPE_WEBHOOK_SECRET` | the signing secret from Step 9 (`whsec_`) |

**Step 11 of 12.** In Stripe, go to **Settings**, then **Business**, then **Public details**. Set
your business name to `ClientShield`, and add your support email and website. Customers see
these on receipts and on the billing page.

**Step 12 of 12.** In Stripe, go to **Settings**, then **Customer emails**. Turn on **Successful
payments** and **Refunds**, so customers get receipts.

---

## Before taking real money

- **Sales tax:** ask your accountant. If needed, turn on **Stripe Tax** in the dashboard. No code
  changes are needed.
- **Refund policy:** your lawyer should include it in the Terms of Service.

You'll do one real test purchase in [the launch checklist](08-launch-checklist.md).

Next: [Launch 6: Deploy the apps](06-deploy-the-apps.md).
