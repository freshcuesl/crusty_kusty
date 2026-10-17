# Guide 7: Try customer records, private notes, retention and abuse flags

**Time:** about 10 minutes.
**You need:** Guide 6 finished. Docker running, `npm run dev` and `npm run dev:admin` started.

---

## Part A: Customer records and private notes

**Step 1 of 9.** In the terminal, in the `crusty_kusty` folder, add the newest tables (your data
stays):

```bash
npx supabase migration up
```

✅ **You should see:** `Applying migration ...notes_retention_abuse.sql`.

**Step 2 of 9.** Open **http://localhost:5173** and click **New customer**. Type a made-up name and
phone number, for example **Test Person** and **(206) 555-0142**. Click **Add and check customer**.

✅ **You should see:** the check result, and a button **Open customer record**.

**Step 3 of 9.** Click **Open customer record**.

✅ **You should see:** the customer's details, a **Customer check** box and **Private notes**.

**Step 4 of 9.** In **New note**, type something like `Prefers morning visits`. Click **Add note**.

✅ **You should see:** your note in the list, with the date. Only people in your business can read
it. Not other businesses, and not ClientShield moderators.

**Step 5 of 9.** Click **Check again**.

✅ **You should see:** a fresh check result. Use this before a repeat booking.

**Step 6 of 9.** Go back home and click **Customers**.

✅ **You should see:** **Test Person** in the list.

---

## Part B: The admin panel

**Step 7 of 9.** Open **http://localhost:5174** and sign in with your admin account. In the menu on
the left, click **Retention**.

✅ **You should see:** each dispute type with how long it's kept: 60 months for chargebacks and
fraud, 24 months for the rest.

**Step 8 of 9.** Next to **Threatened or posted bad review**, change the number to **12** and
click **Save**.

✅ **You should see:** "Retention saved". Incidents verified from now on use the new period. The
number must be between 6 and 60.

**Step 9 of 9.** Click **Dashboard** in the menu.

✅ **You should see:** an **Abuse flags** card that says **0 open**. A flag opens automatically
when a business:

- makes over 100 customer checks in a day
- checks 40 people in a day without saving them as customers
- submits 10 incident reports in a week
- has 3 reports rejected in 90 days

Click a flag to see what to look for. Then write **What you found** and click **Resolve flag**.

---

## What happens on its own

- **Every night at 3:17 AM** the database cleans up:
  - Verified incidents past their retention period: customer details, fingerprints and evidence
    records are deleted. The incident is marked **Expired** and stops matching.
  - Rejected reports a year after the decision get the same cleanup.
  - Drafts left untouched for a year are deleted.
  - Check logs older than 24 months are deleted.
- **Evidence files** are queued for deletion. On the live site, the `purge-expired-files` function
  deletes them every night. It's switched on in the launch guide. On your computer they just wait
  in the queue, which is fine.

## If something goes wrong

| What you see                               | What to do                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| No **Customers** button on the home screen | Refresh the page. If it's still missing, stop `npm run dev` and start it again.   |
| "Only admins can change these"             | Your account is a moderator. Run `npm run make-admin -- you@example.com --admin`. |
| "Customer not found"                       | The record was deleted, or it belongs to another business.                        |
