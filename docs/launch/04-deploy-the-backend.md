# Launch 4: Deploy the backend

**Time:** about 25 minutes.

GitHub puts the database tables and the server functions on your production project. You
click a button. Nothing deploys by itself.

---

## Part A: Give GitHub what it needs

**Step 1 of 13.** On GitHub, open the `crusty_kusty` repository. Click **Settings**, then
**Environments**, then **New environment**. Name it `production` and click **Configure
environment**.

**Step 2 of 13.** Under **Deployment protection rules**, tick **Required reviewers** and add
yourself. Click **Save protection rules**.

✅ **You should see:** every deploy waits for you to click **Approve**. That's a safety catch.

**Step 3 of 13.** Still in the `production` environment, under **Environment secrets**, click
**Add environment secret** twice:

| Name                    | Value                                              |
| ----------------------- | -------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | the Supabase access token (Guide 2, Step 13)       |
| `SUPABASE_DB_PASSWORD`  | the production database password (Guide 2, Step 3) |

**Step 4 of 13.** Under **Environment variables**, click **Add environment variable**:

| Name                   | Value                            |
| ---------------------- | -------------------------------- |
| `SUPABASE_PROJECT_REF` | the project ID (Guide 2, Step 4) |

---

## Part B: Deploy

**Step 5 of 13.** Click the **Actions** tab, then **Deploy backend** on the left, then **Run
workflow**. Check that the branch is **main**. Type `DEPLOY` in the box and click **Run
workflow**.

**Step 6 of 13.** Click the run that appears, then **Review deployments**. Tick **production** and
click **Approve and deploy**.

✅ **You should see:** after a few minutes, every step with a green tick. In Supabase, go to
**Table Editor**. You should see tables like `businesses`, `incidents` and `plans`.

---

## Part C: Secrets for the server functions

**Step 7 of 13.** On your computer, in the `crusty_kusty` folder, make a long random secret:

```bash
npm run generate-secret
```

Copy the line it prints **straight into your password manager** as "Purge files secret".

**Step 8 of 13.** In Supabase, go to **Edge Functions**, then **Secrets**. Add these two (you'll add
the Stripe ones in Guide 5):

| Name                 | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| `APP_URL`            | `https://clientshield.example`                                             |
| `PURGE_FILES_SECRET` | the secret from Step 7                                                     |
| `ADMIN_URL`          | `https://admin.clientshield.example`                                       |
| `ANTHROPIC_API_KEY`  | for Miles: a new Anthropic key named `ClientShield production` (see below) |

> **Miles's key:** In **https://console.anthropic.com**, set a **monthly spend limit** under
> **Settings**, then **Limits**. Then create a key under **API keys** just for production. Use a
> different key from the one on your computer.

**Step 9 of 13.** In Supabase, click **SQL Editor**, then **New query**. Paste the following. Replace
the two `PASTE_...` parts: use your project URL from Guide 2, Step 14, and the secret from
Step 7. Keep the single quotes.

```sql
select vault.create_secret('PASTE_PROJECT_URL', 'project_url');
select vault.create_secret('PASTE_PURGE_SECRET', 'purge_files_secret');
```

Click **Run**.

✅ **You should see:** "Success" with two rows. The nightly cleanup can now delete expired
evidence files.

**Step 10 of 13.** Clear the SQL editor, so the secret isn't left on screen.

---

## Part D: Back up the matching key

The database made a secret key (the "pepper") that turns customer details into fingerprints. If
it's ever lost, verified incidents can no longer be matched.

**Step 11 of 13.** In **SQL Editor**, run:

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'identifier_pepper';
```

**Step 12 of 13.** Copy the value **straight into your password manager** as "ClientShield
identifier pepper". Mark it as very important.

**Step 13 of 13.** Clear the SQL editor.

---

## After this: every time a branch changes the database

When you merge a branch that touched the `supabase` folder, repeat **Steps 5 and 6**. Merges never
change the live database by themselves.

Next: [Launch 5: Stripe live mode](05-stripe-live.md).
