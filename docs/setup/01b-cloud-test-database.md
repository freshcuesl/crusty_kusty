# Guide 1b: Use the free cloud test database (no Docker)

**Time:** about 10 minutes.
**You need:** your free Supabase project `https://mnmlvmctxponwzltixub.supabase.co`.

This project is only for **testing**. The real launch project will be a separate Pro project.

Do one step at a time. After each step, check the ✅ line before moving on.

> **Never paste the secret key** (starts with `sb_secret_`) into chat, the terminal or any file.
> The setup command refuses it anyway.

---

## Part A: Copy your public key

**Step 1 of 11.** Go to **https://supabase.com/dashboard** and open your project.

**Step 2 of 11.** In the left menu, click the **gear icon (Project Settings)**, then **API Keys**.

✅ **You should see:** a **Publishable key** that starts with `sb_publishable_`.

**Step 3 of 11.** Click the **copy** button next to the **Publishable key**.

> Only see "anon" and "service_role"? Copy the **anon** key instead. Never the service_role one.

---

## Part B: Connect the app

**Step 4 of 11.** Open the terminal in the project folder:

```bash
cd C:\Users\devSet\Desktop\crusty_kusty
```

**Step 5 of 11.** Type this and press **Enter**:

```bash
npm run setup:env:cloud
```

It asks two questions. Right-click pastes.

1. **Project URL:** paste `https://mnmlvmctxponwzltixub.supabase.co` and press **Enter**.
2. **Publishable key:** paste the key from Step 3 and press **Enter**.

✅ **You should see:** `✔ Wrote .env.local`.

---

## Part C: Send the database tables and security settings

**Step 6 of 11.** Log the Supabase tool in. Type this and press **Enter**:

```bash
npm run db:login
```

✅ **You should see:** your browser opens. Click to approve. The terminal says you're logged in.

**Step 7 of 11.** Connect this folder to your project:

```bash
npm run db:link
```

It asks for your **database password**, the one you chose when you created the project. Type it
and press **Enter**. The letters won't show while you type; that's normal.

> Forgot it? In the dashboard: **Project Settings** → **Database** → **Reset database password**.

✅ **You should see:** `Finished supabase link`.

**Step 8 of 11.** Send the tables:

```bash
npm run db:push
```

It lists the changes and asks to confirm. Type **Y** and press **Enter**.

✅ **You should see:** `Finished supabase db push`.

**Step 9 of 11.** Send the sign-in security settings (two-step login on, strong passwords):

```bash
npm run db:config:push
```

It shows each change and asks to confirm. Type **y** and press **Enter** each time.

✅ **You should see:** the prompt come back with no red text.

---

## Part D: Open the app

**Step 10 of 11.** Type this and press **Enter**:

```bash
npm run dev
```

**Step 11 of 11.** Open **http://localhost:5173**

✅ **You should see:** the **Sign in** page. Now follow [Guide 2](02-try-sign-in-locally.md) from
Part C, using the notes below.

---

## Differences from the Docker setup

- **Emails are real.** The confirmation email goes to your actual inbox. Supabase's free email
  only sends to **the email you use to log in to Supabase**, a few times per hour. Sign up in the
  app with that email. Testing a second person (a staff invite) comes when we add the Resend email
  service.
- **Making yourself a moderator** (instead of `npm run make-admin`):
  1. In the dashboard left menu, click **SQL Editor**.
  2. Paste this, replacing the email with yours:
     ```sql
     insert into public.platform_roles (user_id, role)
     select id, 'moderator' from auth.users where email = 'you@example.com'
     on conflict (user_id) do update set role = excluded.role;
     ```
  3. Click **Run**. ✅ You should see `Success. 1 row`. If it says **0 rows**, sign up in the app
     first, or check the email spelling.
- **After I add new database changes**, run `npm run db:push` again (Step 8). I'll remind you.
