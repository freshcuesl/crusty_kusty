# Guide 9: Try Miles, the customer service assistant

**Time:** about 15 minutes.
**You need:** Guide 4 finished (`supabase/functions/.env` exists and `npm run functions:serve`
works). Docker running, `npm run dev` and `npm run dev:admin` started.

Miles runs on Claude, Anthropic's AI. Each message costs a few cents, paid to Anthropic with
your API key.

> **Your API key is secret.** It goes only in `supabase/functions/.env` on your computer (and in
> Supabase's secrets at launch). Never in chat, email or a screenshot.

---

## Part A: Get an Anthropic API key

**Step 1 of 10.** Go to **https://console.anthropic.com** and create an account with your own
email.

**Step 2 of 10.** Click **Settings**, then **Billing**. Add a payment card and buy a small amount
of credit, for example $10. You type the card yourself.

**Step 3 of 10.** Still in **Settings**, open **Limits**. Set a **monthly spend limit**, for example
$20. Miles stops answering if it's reached, so a mistake can never cost a lot.

**Step 4 of 10.** Click **API keys**, then **Create key**. Name it `ClientShield local`. Copy the key
(it starts with `sk-ant-`).

---

## Part B: Give the key to your computer

**Step 5 of 10.** Open `crusty_kusty\supabase\functions\.env` in VS Code or Notepad. Add these two
lines at the bottom, pasting your key in place of `PASTE_KEY`:

```
ANTHROPIC_API_KEY=PASTE_KEY
SUPPORT_EMAIL=you@example.com
```

Save the file.

**Step 6 of 10.** In the terminal, update the database (your data stays):

```bash
npx supabase migration up
```

✅ **You should see:** `Applying migration ...miles.sql`.

**Step 7 of 10.** If `npm run functions:serve` is running, click in its terminal, press
**Ctrl+C**, then start it again:

```bash
npm run functions:serve
```

---

## Part C: Talk to Miles

**Step 8 of 10.** Open **http://localhost:5173** and sign in. At the bottom right, click **Ask
Miles**.

✅ **You should see:** Miles in his teal cap and headset, and three starter questions.

**Step 9 of 10.** Click **How do customer checks work?**

✅ **You should see:** "Miles is thinking…", then a short answer after a few seconds.

**Step 10 of 10.** Type `How many checks do I have left this month?` and press **Enter**.

✅ **You should see:** an answer that uses your real plan and usage.

---

## Good to know

- **What Miles does:** customer service only. He answers questions about using ClientShield, like
  checks, verification, plans and billing. He doesn't discuss specific customers or disputes. For
  account problems he points people to the `SUPPORT_EMAIL` address.
- **Who can use him:** everyone who is signed in, on any plan.
- **Limits:** 20 messages per person per day.
- **Privacy:** conversations aren't saved. Emails and phone numbers people type are masked before
  anything is sent. Only the size of each answer is recorded, to track costs.
- **Miles can make mistakes.** The chat says so, every time.

## If something goes wrong

| What you see                     | What to do                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| "Miles is unavailable right now" | Check the key in `.env` starts with `sk-ant-`, then restart `npm run functions:serve` (Step 7). |
| "...messages for you today"      | You reached the daily limit. Try tomorrow.                                                      |
