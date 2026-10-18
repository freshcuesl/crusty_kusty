# Guide 10: A fully verified demo business

**Time:** about 2 minutes.
**You need:** Docker running and an account in the app that owns a business. Use a business
account, not your admin account.

This makes the business fully verified (business details approved, owner ID checked). It also adds
sample data, so every screen has something to show. **Only on your computer**: it can't reach the
live site.

---

**Step 1 of 4.** In the terminal, in the `crusty_kusty` folder (use your business account's email):

```bash
npm run dev:demo -- tripme@example.com
```

✅ **You should see:** two ✔ lines and a sample customer to try.

**Step 2 of 4.** Open **http://localhost:5173**, sign in with that account, and refresh the page.

✅ **You should see:** no "Verify now" warning. Every button on the home screen works.

**Step 3 of 4.** Click **Customer check**. Enter the name **Jordan Demo** and the phone
**(206) 555-0142**. Click **Check customer**.

✅ **You should see:** **Verified incident found**, with a chargeback from about two months ago.

**Step 4 of 4.** Try the rest:

- Pick a decision on the alert, then open **Alerts**.
- Click **New customer** and save someone. Open them under **Customers** and add a private note.
- Report an incident of your own. Then approve it in the admin panel (**Incident review**).
- Open **Plan and billing** to see the Pro trial.

---

## Good to know

- You can run it again any time. It never makes duplicates.
- The sample incident belongs to **Demo Reporter Co (sample data)**. Nobody can sign in as that
  business.
- To start over with a clean database: `npx supabase db reset`. This deletes **all** local data,
  including your accounts.

| What you see                              | What to do                                                   |
| ----------------------------------------- | ------------------------------------------------------------ |
| "That account doesn't own a business yet" | Sign in with it, create the business, then run Step 1 again. |
| "Local Supabase is not running"           | Start Docker Desktop, then `npm run db:start`.               |
| "Demo setup failed"                       | Run `npx supabase migration up`, then Step 1 again.          |
