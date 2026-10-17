# Guide 5: Report an incident and review it (owner and moderator)

**Time:** about 10 minutes.
**You need:** a **verified** business (Guide 3), your account set as a moderator
(`npm run make-admin -- your-email --admin`), and Docker running.

Do one step at a time. After each step, check the ✅ line before moving on.

---

## Part A: Get the newest database changes

**Step 1 of 12.** In the terminal, in the `crusty_kusty` folder:

```bash
npx supabase migration up
```

✅ **You should see:** `Applying migration ...incidents.sql` with no red text.

**Step 2 of 12.** Restart the app: **Ctrl + C**, then `npm run dev`. In a second terminal run
`npm run dev:admin`.

---

## Part B: Report an incident (as the business)

**Step 3 of 12.** Open **http://localhost:5173** and sign in. Click **Report incident**.

✅ **You should see:** a form with **Customer**, **The job** and **The dispute**.

**Step 4 of 12.** Fill in a made-up customer (for example _Test Customer_, phone `(206) 555-0199`),
a date of service in the past, a type of service, choose a dispute type and describe what
happened in a sentence or two. Click **Save and add evidence**.

✅ **You should see:** the incident page with the status **Draft**.

**Step 5 of 12.** Under **Evidence**, choose **Invoice**, click **Choose file**, pick any PDF or
photo, then click **Upload evidence**.

✅ **You should see:** the file listed under Evidence.

**Step 6 of 12.** Click **Submit for review**.

✅ **You should see:** "A moderator is reviewing this incident." The form is now locked.

---

## Part C: Review it (as the moderator)

**Step 7 of 12.** Open **http://localhost:5174** and sign in.

✅ **You should see:** **Incident review: 1 waiting**.

**Step 8 of 12.** Click it, then click the incident.

✅ **You should see:** who reported it, the customer, the dispute, the evidence and the history.

**Step 9 of 12.** Next to the evidence, click **Check**.

✅ **You should see:** **Unchanged since upload**.

**Step 10 of 12.** Type a note such as _Please add before and after photos_ and click
**Ask for more info**.

**Step 11 of 12.** Back in the app, refresh the incident.

✅ **You should see:** your note, and the form is editable again. Add a photo and submit again.

**Step 12 of 12.** In the admin panel, open the incident again and click **Verify evidence**.

✅ **You should see:** in the app, **Evidence verified** and the date the record expires.

---

## What happens behind the scenes

When you click **Verify evidence**, the database stores secret fingerprints of the customer's
name, phone, email and address. The next feature uses them to alert other businesses when a new
booking matches, without ever showing them this customer's details.
