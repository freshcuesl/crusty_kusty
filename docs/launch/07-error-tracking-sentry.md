# Launch 7: Error tracking with Sentry

**Time:** about 15 minutes. **Cost:** free plan.

When the app crashes for someone, Sentry emails you what broke, so it can be fixed.

**What's never sent:**

- names, email addresses, phone numbers, or anything typed into forms
- cookies or sign-in tokens
- the address bar's search part (after `?`)

The app removes these before a report leaves the phone, and tests check that it does.

---

**Step 1 of 8.** Go to **https://sentry.io/signup/** and create an account. When asked for a data
storage location, choose **United States**. Turn on two-step login under **User settings**, then
**Security**.

**Step 2 of 8.** Click **Projects**, then **Create Project**. Choose **React**. Name it
`clientshield-web`. Click **Create Project**.

**Step 3 of 8.** Sentry shows setup code. **Ignore the code**; it's already done. Find the **DSN**
(it looks like `https://abc123@o123.ingest.us.sentry.io/456`). It's safe to share. Copy it.

**Step 4 of 8.** On GitHub, go to **Settings**, then **Environments**, then **production**. Add an
environment variable:

| Name              | Value               |
| ----------------- | ------------------- |
| `VITE_SENTRY_DSN` | the DSN from Step 3 |

**Step 5 of 8.** In Sentry, open the project's **Settings**, then **Security & Privacy**. Turn on:

- **Data Scrubber**
- **Use Default Scrubbers**
- **Prevent Storing of IP Addresses**

Save.

**Step 6 of 8.** In Sentry, go to **Alerts**, then **Create Alert**. Choose **Issues**, then **When
a new issue is created**, then **Send a notification to: you**. Save.

**Step 7 of 8.** On GitHub, go to **Actions**, then **Deploy apps**, then **Run workflow**, and
approve it. The apps are rebuilt with error tracking turned on.

**Step 8 of 8.** Check it works. Open `https://clientshield.example`, then open **Developer tools**
(F12), then the **Console** tab. Look for a line mentioning Sentry. There should be **no** red
"Content Security Policy" errors.

✅ **You should see:** no CSP errors. The security headers already allow Sentry's address.

---

The admin panel uses the same DSN, so its errors show up in the same project.

Next: [Launch 8: Launch checklist](08-launch-checklist.md).
