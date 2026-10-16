# Guide 4: Connect Stripe Identity (test mode)

**Time:** about 20 minutes, once.
**You need:** Guides 1–3 done, Docker running, and an email address for Stripe.

Stripe checks the business owner's ID and selfie. **Test mode** means no real money and no real
IDs: Stripe shows test buttons like "Verify" and "Fail" instead of using a camera.

> **Keys are secret.** You'll copy two keys. Paste them **only** where this guide says. Never
> into chat, email or a screenshot. ClientShield's code never stores them in git.

---

## Part A: Create your Stripe account

**Step 1 of 13.** Go to **https://dashboard.stripe.com/register** and create an account. You
type your own details. Claude can't create accounts for you.

**Step 2 of 13.** In the Stripe dashboard, turn on **Test mode** (switch at the top right).

✅ **You should see:** an orange **Test mode** banner.

**Step 3 of 13.** In the search box at the top, type **Identity** and open it. If Stripe asks
you to get started with Identity, follow its prompts in test mode.

---

## Part B: Give your computer the secret key

**Step 4 of 13.** In Stripe: **Developers** → **API keys**. Next to **Secret key**
(starts with `sk_test_`), click **Reveal** and copy it.

**Step 5 of 13.** In VS Code or Notepad, open the file
`crusty_kusty\supabase\functions\.env`. If it doesn't exist, copy
`supabase\functions\.env.example` and rename the copy to `.env`.

**Step 6 of 13.** Replace `sk_test_replace_me` with the key you copied. Save the file.

✅ **You should see:** `STRIPE_SECRET_KEY=sk_test_...` with your key.

---

## Part C: Let Stripe send results to your computer

Stripe tells ClientShield the result by sending a message (a "webhook"). On your own computer,
the **Stripe CLI** passes those messages along.

**Step 7 of 13.** Install the Stripe CLI. In a terminal, type:

```bash
winget install Stripe.StripeCLI
```

Close the terminal and open a new one afterwards.

**Step 8 of 13.** Log the Stripe CLI in:

```bash
stripe login
```

✅ **You should see:** your browser opens. Click **Allow access**.

**Step 9 of 13.** Start forwarding (leave this terminal open while testing):

```bash
stripe listen --events identity.verification_session.verified,identity.verification_session.requires_input,identity.verification_session.processing,identity.verification_session.canceled --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

✅ **You should see:** `Your webhook signing secret is whsec_...`

**Step 10 of 13.** Copy that `whsec_...` value into the `.env` file from Step 5, replacing
`whsec_replace_me`. Save.

---

## Part D: Try it

**Step 11 of 13.** In another terminal in the `crusty_kusty` folder:

```bash
npm run functions:serve
```

Leave it running.

**Step 12 of 13.** Start the app (`npm run dev`), sign in as the owner, open **Verification**,
and in **3. Verify your identity** click **Verify my identity**.

✅ **You should see:** Stripe's test verification page.

**Step 13 of 13.** On Stripe's page, choose the **verify** test option and finish. You come back
to ClientShield.

✅ **You should see:** "Stripe is checking your ID", then after **Check again**:
**Identity verified by Stripe.** In the Step 9 terminal, a line ending in `[200]`.

---

## Going live later

For the hosted project, the same two secrets are set with `npx supabase secrets set ...` and a
webhook endpoint is added in the Stripe dashboard. That's part of the launch guide.

## If something goes wrong

| What you see                            | What to do                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| "Could not start identity verification" | Check the `sk_test_` key in `.env`, then restart `npm run functions:serve`.                                         |
| Stays on "Stripe is checking your ID"   | Is the Step 9 terminal still open? Does its `whsec_` match `.env`? Restart `functions:serve` after changing `.env`. |
| `[400]` in the Step 9 terminal          | The `whsec_` in `.env` doesn't match. Copy it again from Step 9.                                                    |
| No Stripe account yet                   | Use `npm run dev:verify-identity -- you@example.com` to skip the check on your computer only.                       |
