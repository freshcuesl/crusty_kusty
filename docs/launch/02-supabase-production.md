# Launch 2: Supabase production project

**Time:** about 30 minutes. **Cost:** Supabase Pro, about $25 a month.

This is a **new, separate** project for real customers. Keep your test project from Guide 1b for
trying things.

---

## Part A: Create the project

**Step 1 of 14.** Go to **https://supabase.com/dashboard** and sign in. Turn on two-step login
for your Supabase account. Click your profile picture, then **Account preferences**, then
**Security**.

**Step 2 of 14.** Click **New organization**. Name it `ClientShield` and choose the **Pro** plan.
Add your payment card. You type it yourself.

**Step 3 of 14.** Click **New project**:

- **Name:** `clientshield-production`
- **Database password:** click **Generate a password**, then copy it **straight into your
  password manager** as "Supabase production database password".
- **Region:** **East US (North Virginia)**, or the US region nearest most of your customers.

Click **Create new project**.

✅ **You should see:** "Setting up project". Wait until it finishes (about 2 minutes).

**Step 4 of 14.** Click **Project Settings** (gear icon, bottom left), then **General**. Copy the
**Project ID**, for example `abcdefghijklmnop`. Save it in your password manager as "Supabase
project ref". It isn't secret, but you'll need it several times.

---

## Part B: Sign-in security

These match the settings you've been testing with on your computer.

**Step 5 of 14.** In the left menu, click **Authentication**, then **URL Configuration**:

- **Site URL:** `https://clientshield.example`
- **Redirect URLs:** click **Add URL** and add `https://clientshield.example/**`. Then add
  `https://admin.clientshield.example/**` the same way.

Click **Save**.

**Step 6 of 14.** Go to **Authentication**, then **Sign In / Providers**, then **Email**. Check:

- **Confirm email** is **on**.
- **Secure email change** is **on**.
- **Secure password change** is **on**.

Save.

**Step 7 of 14.** On the same page, or under **Authentication**, then **Passwords**:

- **Minimum password length:** `12`
- **Password requirements:** lowercase, uppercase, digits and symbols.
- **Leaked password protection:** **on** (a Pro feature). It refuses passwords that have shown up
  in data breaches.

Save.

**Step 8 of 14.** Go to **Authentication**, then **Multi-Factor**. Check that **TOTP
(authenticator app)** is **enabled**. Set the maximum number of factors per user to **5**. Leave
phone turned off. Save.

**Step 9 of 14.** Go to **Authentication**, then **Sign In / Providers**. Check that every provider
**except Email** is turned **off**.

---

## Part C: Data safety

**Step 10 of 14.** Go to **Project Settings**, then **Database**. Check that **Enforce SSL on
incoming connections** is **on**.

**Step 11 of 14.** Go to **Database**, then **Backups**. Pro keeps daily backups for 7 days.
**Point-in-time recovery** is a paid add-on that lets you restore to any minute. Turn it on once
you have paying customers.

**Step 12 of 14.** Go to **Project Settings**, then **API Keys**. You'll see:

- the **publishable** key (starts with `sb_publishable_`). It's safe in the app. You'll use it in
  Guide 6.
- the **secret** key (starts with `sb_secret_`). **Never** copy it anywhere. ClientShield doesn't
  need it.

---

## Part D: Personal access token for GitHub

GitHub uses this token to update the database for you (Guide 4).

**Step 13 of 14.** Click your profile picture, then **Account preferences**, then **Access
Tokens**. Click **Generate new token**, name it `GitHub deploy`, and pick an expiry date if asked.
Copy it **straight into your password manager** as "Supabase access token".

✅ **You should see:** the token listed. Supabase won't show it again.

**Step 14 of 14.** Write down in your password manager: the project URL. It's
`https://<project ID>.supabase.co`, for example `https://abcdefghijklmnop.supabase.co`.

---

**Done.** You saved: the database password, the project ID, the access token and the project URL.

Next: [Launch 3: Email with Resend](03-email-resend.md).
