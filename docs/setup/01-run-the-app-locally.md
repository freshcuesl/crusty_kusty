# Guide 1: Run the app on your computer

**Time:** about 15 minutes the first time (mostly waiting for downloads).
**You need:** this computer, which already has Node, Git and Docker Desktop.

Do one step at a time. After each step, check the ✅ line before moving on.

---

## Part A: Start Docker (the engine the database runs in)

**Step 1 of 9.** Press the **Windows key**, type **Docker Desktop**, and press **Enter**.

✅ **You should see:** a whale icon in the taskbar near the clock. Wait until Docker Desktop
says **"Engine running"** in the bottom-left corner of its window. This can take a minute.

> If Docker asks you to accept terms or sign in, you can accept the terms. Signing in is optional.

---

## Part B: Open a terminal in the project

**Step 2 of 9.** In the Claude app, open the **Terminal** panel. Or press the **Windows key**,
type **PowerShell**, and press **Enter**.

**Step 3 of 9.** Type this and press **Enter**:

```bash
cd C:\Users\devSet\Desktop\crusty_kusty
```

✅ **You should see:** the line now ends with `crusty_kusty>`.

---

## Part C: Install and start everything

**Step 4 of 9.** Install the project's building blocks. Type this and press **Enter**:

```bash
npm install
```

✅ **You should see:** `found 0 vulnerabilities` or a short summary. Warnings are OK.

**Step 5 of 9.** Start the local database. Type this and press **Enter**:

```bash
npm run db:start
```

⏳ The **first time** it downloads about 2 to 3 GB. This can take 5 to 10 minutes. Later
starts take about 20 seconds.

✅ **You should see:** a list that includes `API URL: http://127.0.0.1:54321`.

**Step 6 of 9.** Connect the app to the database. Type this and press **Enter**:

```bash
npm run setup:env
```

✅ **You should see:** `✔ Wrote .env.local`.

**Step 7 of 9.** Start the app. Type this and press **Enter**:

```bash
npm run dev
```

✅ **You should see:** `Local: http://localhost:5173/`.

**Step 8 of 9.** Open your web browser and go to **http://localhost:5173**

✅ **You should see:** the dark blue header with the ClientShield logo and **"What do you need?"**

**Step 9 of 9.** When you're done, go back to the terminal and press **Ctrl + C** to stop
the app. To stop the database too, type this and press **Enter**:

```bash
npm run db:stop
```

---

## Extra: see the admin panel

In a **second** terminal (repeat Step 3 first), type this and press **Enter**:

```bash
npm run dev:admin
```

Then open **http://localhost:5174**

## Extra: look inside the database

While the database is running, open **http://127.0.0.1:54323**. This is Supabase Studio,
a website for looking at your local data.

## Extra: see test emails

Login and confirmation emails don't go out to real inboxes during local development. Open
**http://127.0.0.1:54324** to read them.

---

## If something goes wrong

| What you see                                                                          | What to do                                                                                   |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `docker ... cannot find the file specified`                                           | Docker isn't running. Repeat Step 1 and wait for "Engine running".                           |
| `Local Supabase is not running`                                                       | Run Step 5 again, then Step 6.                                                               |
| `Missing or invalid environment variables` in the browser                             | Run Step 6 again, then restart Step 7.                                                       |
| `Failed to resolve import "virtual:pwa-register/react"` (or another `virtual:` error) | The app was started before its settings changed. Press **Ctrl + C**, then run Step 7 again.  |
| `Port 5173 is in use`                                                                 | The app is already running in another terminal. Use that one, or close it with **Ctrl + C**. |

Still stuck? Copy the red text from the terminal and paste it to Claude.
