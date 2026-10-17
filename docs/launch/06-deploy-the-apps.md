# Launch 6: Deploy the apps

**Time:** about 30 minutes.

GitHub builds the contractor app and the admin panel and puts them on Cloudflare. After this,
**every merge to `main` updates the live site by itself**, but only after all the checks pass.

---

## Part A: Create the two Cloudflare projects

**Step 1 of 17.** In a terminal in the `crusty_kusty` folder, log in to Cloudflare:

```bash
npx wrangler@4.151.1 login
```

✅ **You should see:** your browser opens. Click **Allow**.

**Step 2 of 17.** Create the project for the contractor app:

```bash
npx wrangler@4.151.1 pages project create clientshield-web --production-branch=main
```

**Step 3 of 17.** Create the project for the admin panel:

```bash
npx wrangler@4.151.1 pages project create clientshield-admin --production-branch=main
```

✅ **You should see:** both say "Successfully created".

---

## Part B: A Cloudflare token for GitHub

**Step 4 of 17.** In the Cloudflare dashboard, click your profile icon, then **My Profile**, then
**API Tokens**, then **Create Token**. Next to **Create Custom Token**, click **Get started**.

**Step 5 of 17.** Fill in:

- **Token name:** `GitHub deploy`
- **Permissions:** **Account**, then **Cloudflare Pages**, then **Edit**
- **Account resources:** **Include**, then your account

Click **Continue to summary**, then **Create Token**. Copy it **straight into your password
manager** as "Cloudflare deploy token".

**Step 6 of 17.** On the Cloudflare dashboard home page, find **Account ID** (on the right, or under
**Account details**). Copy it. It isn't secret.

---

## Part C: Tell GitHub the settings

**Step 7 of 17.** On GitHub, go to **Settings**, then **Environments**, then **production**. Under
**Environment secrets**, add:

| Name                   | Value                 |
| ---------------------- | --------------------- |
| `CLOUDFLARE_API_TOKEN` | the token from Step 5 |

**Step 8 of 17.** Under **Environment variables** (still in **production**), add each of these:

| Name                       | Value                                                           |
| -------------------------- | --------------------------------------------------------------- |
| `VITE_SUPABASE_URL`        | your project URL, like `https://abcdefghijklmnop.supabase.co`   |
| `VITE_SUPABASE_ANON_KEY`   | the **publishable** key (`sb_publishable_...`, Guide 2 Step 12) |
| `VITE_ADMIN_URL`           | `https://admin.clientshield.example`                            |
| `VITE_APP_URL`             | `https://clientshield.example`                                  |
| `CLOUDFLARE_ACCOUNT_ID`    | the account ID from Step 6                                      |
| `CLOUDFLARE_WEB_PROJECT`   | `clientshield-web`                                              |
| `CLOUDFLARE_ADMIN_PROJECT` | `clientshield-admin`                                            |
| `VITE_CONTACT_EMAIL`       | optional: the email for **Contact us** on the Business plan     |

**Step 9 of 17.** Go to **Settings**, then **Secrets and variables**, then **Actions**, then the
**Variables** tab. Add a **repository variable**:

| Name             | Value  |
| ---------------- | ------ |
| `DEPLOY_ENABLED` | `true` |

This switches on automatic deploys.

---

## Part D: First deploy

**Step 10 of 17.** Click **Actions**, then **Deploy apps**, then **Run workflow** (branch **main**).
Approve it like in Guide 4.

✅ **You should see:** green ticks after a few minutes. The build stops with a clear message if a
setting is missing, or if a secret key was put where the publishable key goes.

**Step 11 of 17.** In Cloudflare, go to **Workers & Pages**, then **clientshield-web**, then
**Custom domains**, then **Set up a custom domain**. Type `clientshield.example` and confirm.

**Step 12 of 17.** Do the same for **clientshield-admin** with `admin.clientshield.example`.

✅ **You should see:** both domains **Active** after a few minutes.

---

## Part E: Lock the admin panel behind Cloudflare Access (recommended)

This adds a second door: only email addresses you list can even load the admin page.

**Step 13 of 17.** In Cloudflare, open **Zero Trust**. If asked, pick a team name and the **Free**
plan.

**Step 14 of 17.** Go to **Access**, then **Applications**, then **Add an application**, then
**Self-hosted**. Set **Application domain** to `admin.clientshield.example`.

**Step 15 of 17.** Add a policy named `Staff`. Set **Action** to **Allow**, and **Include** to
**Emails**. Add your own email and each moderator's email. Save.

✅ **You should see:** opening `https://admin.clientshield.example` first asks for an emailed
code, then shows the ClientShield admin sign-in.

---

## Part F: Make yourself the admin

**Step 16 of 17.** Open `https://clientshield.example`. Sign up, confirm your email, and set up
two-step login. This checks that the Resend email from Guide 3 works.

**Step 17 of 17.** In Supabase, go to **SQL Editor**. Run this with **your** email:

```sql
insert into public.platform_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

✅ **You should see:** "Success. 1 row". Sign in at `https://admin.clientshield.example`.

For moderators later, use the same line with `'moderator'` instead of `'admin'`.

Next: [Launch 7: Error tracking with Sentry](07-error-tracking-sentry.md).
