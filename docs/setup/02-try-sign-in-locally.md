# Guide 2: Try sign-up and two-step login on your computer

**Time:** about 15 minutes.
**You need:** Guide 1 finished (Docker running, `npm run dev` working), and your phone.

> **Using the cloud test database (Guide 1b)?** Skip Part B. In Step 7 the email arrives in
> your real inbox instead. For Step 13, use the SQL from Guide 1b.

Do one step at a time. After each step, check the ✅ line before moving on.

---

## Part A: Get an authenticator app on your phone

**Step 1 of 14.** On your phone, install **Google Authenticator** or **Microsoft Authenticator**
from the App Store or Google Play. Both are free.

✅ **You should see:** the app open with a button to add an account.

---

## Part B: Start everything

**Step 2 of 14.** Open the terminal in the project folder (Guide 1, Step 3).

**Step 3 of 14.** Type this and press **Enter**:

```bash
npm run db:reset
```

This rebuilds the local database with the newest tables. It erases local test data only,
never anything real.

✅ **You should see:** `Finished supabase db reset`.

**Step 4 of 14.** Type this and press **Enter**:

```bash
npm run dev
```

✅ **You should see:** `Local: http://localhost:5173/`.

---

## Part C: Create an account

**Step 5 of 14.** Open **http://localhost:5173** in your browser.

✅ **You should see:** the **Sign in** page.

**Step 6 of 14.** Click **Create an account**. Fill in your name, an email (any email works
locally, for example `me@test.com`) and a password. Watch the checklist turn green.
Click **Create account**.

✅ **You should see:** **Check your email**.

**Step 7 of 14.** Open **http://127.0.0.1:54324** in a new browser tab. This is the local
test inbox. Nothing is sent to real email addresses.

✅ **You should see:** an email for the address you used. Open it and click the confirm link.

---

## Part D: Turn on two-step login

**Step 8 of 14.** Go back to **http://localhost:5173** and sign in with your email and password.

✅ **You should see:** **Turn on two-step login** with a QR code.

**Step 9 of 14.** In the authenticator app on your phone, tap **+** or **Add**, choose
**Scan a QR code**, and point the camera at the screen.

✅ **You should see:** "Crusty Krustees" in the app with a 6-digit code that changes every 30
seconds.

**Step 10 of 14.** Type the 6-digit code from your phone into the page and click
**Turn on two-step login**.

✅ **You should see:** **Set up your business**.

---

## Part E: Create your business

**Step 11 of 14.** Type a business name and click **Create business**.

✅ **You should see:** the home screen, with a yellow note saying your business isn't verified
yet. That's expected. Verification is the next feature.

**Step 12 of 14.** Click the **person icon** in the top right, then **Team**. Type a
coworker's email and click **Create invite link**.

✅ **You should see:** a link you could copy and text to them.

---

## Part F: Make yourself a moderator and open the admin panel

**Step 13 of 14.** In a **second** terminal in the project folder, type this with **your**
email and press **Enter**:

```bash
npm run make-admin -- me@test.com
```

✅ **You should see:** `✔ me@test.com is now a moderator`.

**Step 14 of 14.** Type `npm run dev:admin` and press **Enter**. Open
**http://localhost:5174**, sign in, and enter the code from your phone.

✅ **You should see:** the **Moderation** dashboard.

---

## If something goes wrong

| What you see                             | What to do                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| No email in the test inbox               | Wait 10 seconds and refresh the inbox page.                                                        |
| "That code didn't work"                  | Codes change every 30 seconds. Type the newest one. Check your phone's clock is set automatically. |
| "This account doesn't have admin access" | Run Step 13 with the exact email you signed up with.                                               |
| "Local Supabase is not running"          | Start Docker Desktop, then run `npm run db:start`.                                                 |
