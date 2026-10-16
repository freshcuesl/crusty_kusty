# Guide 3: Try business verification (owner and moderator)

**Time:** about 10 minutes.
**You need:** Guide 2 finished: an account with two-step login and a business. Docker running.

Do one step at a time. After each step, check the ✅ line before moving on.

---

## Part A: Get the newest database changes

**Step 1 of 12.** In the terminal, in the `crusty_kusty` folder, type:

```bash
npx supabase migration up
```

This adds the new verification tables without erasing your account.

✅ **You should see:** `Applying migration ...business_verification.sql` and no red text.

**Step 2 of 12.** Restart the app: press **Ctrl + C** in the app's terminal, then run `npm run dev`.

---

## Part B: As the business owner

**Step 3 of 12.** Open **http://localhost:5173** and sign in.

✅ **You should see:** a yellow note **"Your business isn't verified yet"** and three locked tiles.

**Step 4 of 12.** Click **Verify now**.

✅ **You should see:** **Verification** with three steps.

**Step 5 of 12.** In **1. Business details**, type a phone number like `(206) 555-0100`, a street,
city, state and ZIP. Click **Save details**.

✅ **You should see:** **Details saved.**

**Step 6 of 12.** In **2. Proof documents**, choose **Business license**, click **Choose file**,
pick any PDF or photo on your computer, then click **Upload document**.

✅ **You should see:** the file listed under the form.

**Step 7 of 12.** In **3. Submit for review**, click **Submit for review**.

✅ **You should see:** **"We're reviewing your business."** The forms are now locked.

---

## Part C: As the moderator

**Step 8 of 12.** If you haven't yet, make yourself a moderator (use your own email):

```bash
npm run make-admin -- me@test.com
```

**Step 9 of 12.** In a second terminal, run `npm run dev:admin`. Open **http://localhost:5174**
and sign in with your password and authenticator code.

✅ **You should see:** **Business verifications: 1 waiting**.

**Step 10 of 12.** Click it, then click your business.

✅ **You should see:** your details, your document and the history.

**Step 11 of 12.** Next to the document, click **Check**.

✅ **You should see:** **Unchanged since upload**.

**Step 12 of 12.** Click **Approve**. Then go back to the app at **http://localhost:5173** and
refresh.

✅ **You should see:** the yellow note is gone and the tiles are unlocked.

---

## Try the other decisions too

Type a note and click **Ask for more info** instead. Back in the app, the note appears on the
**Verification** page and you can change things and submit again.

## If something goes wrong

| What you see                                   | What to do                                                   |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `relation "business_documents" does not exist` | Run Step 1 again, then restart the app.                      |
| "Only the business owner can do this"          | Staff can see verification but only the owner can change it. |
| "Upload a PDF or a photo"                      | Use a PDF, JPG, PNG, WEBP or HEIC file under 10 MB.          |
| Admin shows "0 waiting"                        | Make sure Step 7 showed "We're reviewing your business."     |
