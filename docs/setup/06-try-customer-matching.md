# Guide 6: Try customer matching and alerts

**Time:** about 5 minutes.
**You need:** Guide 5 finished: a **verified** incident about a test customer. Docker running and
`npm run dev` started.

---

**Step 1 of 6.** In the terminal, in the `crusty_kusty` folder, add the newest tables (your data
stays):

```bash
npx supabase migration up
```

✅ **You should see:** `Applying migration ...matching.sql`.

**Step 2 of 6.** Open **http://localhost:5173** and click **Customer check**.

✅ **You should see:** a form and a note that this is only for customers you already have.

**Step 3 of 6.** Type **only one** detail from the customer in your verified incident, for example
just the phone number, plus a made-up name. Click **Check customer**.

✅ **You should see:** "No verified incidents found." One matching detail is never enough.

**Step 4 of 6.** Click **Check another customer**. This time type **two** details from that
customer: the same phone number **and** the same name. Try typing the phone differently, like
`206.555.0199`. Click **Check customer**.

✅ **You should see:** **Verified incident found**, with a card showing only facts: dispute type,
month, evidence count, review rating and "Verified business". It doesn't show the customer's
details or who reported them.

**Step 5 of 6.** Click **Require additional authorization**.

✅ **You should see:** "Decision saved: Require additional authorization".

**Step 6 of 6.** Go back home and click **Alerts**.

✅ **You should see:** the alert listed with your decision. Click it to open the facts again.

---

## Why it works this way

- **Two details must agree.** Families share addresses and phones change hands, so a single
  detail is never enough.
- **Facts, not labels.** Alerts never say "don't serve this person". You decide.
- **No people search.** You can only check details you already have, every check is logged, and
  each business can make up to 300 checks a day.
