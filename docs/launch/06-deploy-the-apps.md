# Launch 6: Deploy the apps

**Time:** about 30 minutes.

Cloudflare builds the contractor app and the admin panel straight from GitHub. After this,
**every merge to `main` updates the live site by itself.** You make two Cloudflare **Workers**,
one for each app, and both are connected to the same GitHub repository.

> **Merge only when GitHub's checks are green.** Cloudflare publishes whatever is on `main`. It
> doesn't wait for the tests.

---

## Part A: The contractor app

**Step 1 of 14.** In Cloudflare, go to **Workers & Pages**, then **Create**, then **Import a
repository** (or **Connect to Git**). Choose GitHub, allow access to **crusty_kusty**, and select
it.

**Step 2 of 14.** Fill in the build settings exactly like this:

| Setting                   | Value                                                  |
| ------------------------- | ------------------------------------------------------ |
| **Project / Worker name** | `clientshield-web`                                     |
| **Production branch**     | `main`                                                 |
| **Root directory** (Path) | leave empty (the top of the repository)                |
| **Build command**         | `npm run build --workspace @cs/web`                    |
| **Deploy command**        | `npx wrangler deploy --config apps/web/wrangler.jsonc` |

The name must be exactly `clientshield-web`. It has to match the name in
`apps/web/wrangler.jsonc`.

**Step 3 of 14.** Open **Advanced settings** (or, after creating it, **Settings**, then **Build**,
then **Variables and secrets**). Add these **build variables**:

| Name                      | Value                                                                          |
| ------------------------- | ------------------------------------------------------------------------------ |
| `NODE_VERSION`            | `24`                                                                           |
| `VITE_SUPABASE_URL`       | your project URL, like `https://abcdefghijklmnop.supabase.co`                  |
| `VITE_SUPABASE_ANON_KEY`  | the **publishable** key (`sb_publishable_...`, Guide 2 Step 12)                |
| `VITE_ADMIN_URL`          | `https://admin.clientshield.example`                                           |
| `VITE_CONTACT_EMAIL`      | optional: the email for **Contact us** on the Business plan                    |
| `VITE_SENTRY_DSN`         | optional, from Guide 7                                                         |
| `VITE_CF_ANALYTICS_TOKEN` | optional, from Guide 7 Part B                                                  |
| `VITE_SOCIAL_FACEBOOK`    | optional: your Facebook page (`https://...`). Until set, it opens facebook.com |
| `VITE_SOCIAL_INSTAGRAM`   | optional: your Instagram page. Until set, it opens instagram.com               |
| `VITE_SOCIAL_X`           | optional: your X page. Until set, it opens x.com                               |

> **Never** put the Supabase `sb_secret_` key here. These values are built into the app that
> every visitor downloads. The app refuses to start with a secret key.

**Step 4 of 14.** Click **Deploy** (or **Save and deploy**).

✅ **You should see:** after a few minutes, **Success: Deploy command completed** at the end of the
build log.

**Step 5 of 14.** In the Worker, go to **Settings**, then **Domains & Routes**, then **Add**, then
**Custom domain**. Type `clientshield.example` and add it.

✅ **You should see:** the domain marked **Active** after a few minutes. Open it, and the landing page
shows.

---

## Part B: The admin panel

**Step 6 of 14.** Repeat Step 1, choosing the same repository again.

**Step 7 of 14.** Use these build settings:

| Setting                   | Value                                                    |
| ------------------------- | -------------------------------------------------------- |
| **Project / Worker name** | `clientshield-admin`                                     |
| **Production branch**     | `main`                                                   |
| **Root directory** (Path) | leave empty                                              |
| **Build command**         | `npm run build --workspace @cs/admin`                    |
| **Deploy command**        | `npx wrangler deploy --config apps/admin/wrangler.jsonc` |

**Step 8 of 14.** Add these build variables:

| Name                     | Value                              |
| ------------------------ | ---------------------------------- |
| `NODE_VERSION`           | `24`                               |
| `VITE_SUPABASE_URL`      | the same as Step 3                 |
| `VITE_SUPABASE_ANON_KEY` | the same publishable key as Step 3 |
| `VITE_APP_URL`           | `https://clientshield.example`     |
| `VITE_SENTRY_DSN`        | optional, the same as Step 3       |

**Step 9 of 14.** Click **Deploy**. Then add the custom domain `admin.clientshield.example` the
same way as Step 5.

---

## Part C: If you already made a Worker with another name

Did you connect the repository before this guide, for example as `crusty-kusty`? Then delete that
Worker (**Settings**, then **Delete**) and follow Parts A and B. Its build fails with "detection logic
has been run in the root of a workspace", because it doesn't know which of the two apps to publish.

> The **Deploy apps** workflow in GitHub's Actions tab is a second way to publish (Pages plus a
> GitHub token). Leave it switched off (`DEPLOY_ENABLED` not set) when Cloudflare builds from
> GitHub, so the site isn't published twice.

---

## Part D: Lock the admin panel behind Cloudflare Access (recommended)

This adds a second door: only email addresses you list can even load the admin page.

**Step 10 of 14.** In Cloudflare, open **Zero Trust**. If asked, pick a team name and the **Free**
plan.

**Step 11 of 14.** Go to **Access**, then **Applications**, then **Add an application**, then
**Self-hosted**. Set **Application domain** to `admin.clientshield.example`.

**Step 12 of 14.** Add a policy named `Staff`. Set **Action** to **Allow**, and **Include** to
**Emails**. Add your own email and each moderator's email. Save.

✅ **You should see:** opening `https://admin.clientshield.example` first asks for an emailed
code, then shows the ClientShield admin sign-in.

---

## Part E: Make yourself the admin

**Step 13 of 14.** Open `https://clientshield.example`. Sign up, confirm your email, and set up
two-step login. This checks that the Resend email from Guide 3 works.

**Step 14 of 14.** In Supabase, go to **SQL Editor**. Run this with **your** email:

```sql
insert into public.platform_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

✅ **You should see:** "Success. 1 row". Sign in at `https://admin.clientshield.example`.

For moderators later, use the same line with `'moderator'` instead of `'admin'`.

Next: [Launch 7: Error tracking with Sentry](07-error-tracking-sentry.md).
