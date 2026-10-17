# Guide 9: Try Miles, the AI assistant

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
ADMIN_URL=http://localhost:5174
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
Miles**. Then click **How do customer checks work?**

✅ **You should see:** "Miles is thinking…", then an answer after a few seconds.

**Step 9 of 10.** Open one of your draft incidents (**My incidents**, then a draft). Click **Review
my report with Miles**, then **Review my report**.

✅ **You should see:** suggestions to make the report clearer and more neutral, and which evidence
to add.

**Step 10 of 10.** Open **http://localhost:5174** (admin panel), click **Insights**, then **Ask
Miles**, then **What stands out lately?**

✅ **You should see:** a short summary of your numbers.

---

## Good to know

- **Plans:** Miles is part of Pro and Team, and the free trial. On Free, **Ask Miles** shows an
  upgrade note.
- **Limits:** 40 messages per person per day (200 for ClientShield staff).
- **Privacy:** Conversations aren't saved. Miles never sees customer contact details: emails and
  phone numbers are masked before anything is sent, and alerts reach him without names. In the
  report coach, he reads your report as you wrote it. Only the type of question and the
  size of each answer are recorded, to track costs.
- **Miles can make mistakes.** He never decides who was right and never tells anyone to refuse a
  customer.

## If something goes wrong

| What you see                        | What to do                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| "Miles is unavailable right now"    | Check the key in `.env` starts with `sk-ant-`, then restart `npm run functions:serve` (Step 7). |
| Nothing happens in the admin panel  | Check `ADMIN_URL=http://localhost:5174` is in `.env`, then restart Step 7.                      |
| "Miles is included in Pro and Team" | Your test business is on Free. Its trial has ended or it has no plan.                           |
| "...messages for you today"         | You reached the daily limit. Try tomorrow.                                                      |
